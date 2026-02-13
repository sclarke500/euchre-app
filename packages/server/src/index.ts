import { WebSocket } from 'ws'
import type {
  ClientMessage,
  ServerMessage,
  Table,
  TeamScore,
  Card,
  Bid,
} from '@euchre/shared'
import { parseClientMessage } from './ws/validation.js'
import { routeClientMessage } from './ws/router.js'
import type { ConnectedClient } from './ws/types.js'
import { createWebSocketServer } from './ws/transport.js'
import { enqueueGameCommand } from './sessions/commandQueue.js'
import { handleBugReport } from './bugReport.js'
import { createLobbyHandlers, type DisconnectedPlayer } from './lobby/handlers.js'
import { createSessionHandlers } from './sessions/handlers.js'
import {
  games,
  presidentGames,
  gameHosts,
  gameTypes,
  getCurrentStateSeq,
} from './sessions/registry.js'

const PORT = parseInt(process.env.PORT || '3001', 10)

// ============================================
// Types
// ============================================

// ============================================
// State
// ============================================

const clients = new Map<WebSocket, ConnectedClient>()
const tables = new Map<string, Table>()
const disconnectedPlayers = new Map<string, DisconnectedPlayer>()

// ============================================
// Helpers
// ============================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

function sendToPlayer(odusId: string, message: ServerMessage): void {
  for (const [ws, client] of clients) {
    if (client.player?.odusId === odusId) {
      send(ws, message)
      break
    }
  }
}

function broadcast(message: ServerMessage, excludeWs?: WebSocket): void {
  for (const [ws] of clients) {
    if (ws !== excludeWs) {
      send(ws, message)
    }
  }
}

function broadcastToTable(tableId: string, message: ServerMessage, excludeWs?: WebSocket): void {
  for (const [ws, client] of clients) {
    if (client.tableId === tableId && ws !== excludeWs) {
      send(ws, message)
    }
  }
}

function broadcastToGame(gameId: string, message: ServerMessage): void {
  for (const [ws, client] of clients) {
    if (client.gameId === gameId) {
      send(ws, message)
    }
  }
}

const lobbyHandlers = createLobbyHandlers({
  clients,
  tables,
  games,
  presidentGames,
  disconnectedPlayers,
  generateId,
  send,
  broadcast,
  broadcastToTable,
})


function isDuplicateCommand(client: ConnectedClient, commandId?: string): boolean {
  if (!commandId) return false
  if (!client.recentCommandIds) client.recentCommandIds = []

  if (client.recentCommandIds.includes(commandId)) {
    return true
  }

  client.recentCommandIds.push(commandId)
  if (client.recentCommandIds.length > 50) {
    client.recentCommandIds.shift()
  }
  return false
}

const sessionHandlers = createSessionHandlers({
  clients,
  tables,
  disconnectedPlayers,
  generateId,
  send,
  sendToPlayer,
  broadcast,
  broadcastToGame,
})

/**
 * Try to recover client.gameId if the player is in a game but gameId wasn't set properly.
 * This handles race conditions during reconnection where the gameId association was lost.
 * Returns true if client is now confirmed in a game, false otherwise.
 */
function ensureGameIdRecovered(client: ConnectedClient): boolean {
  if (client.gameId) return true
  if (!client.player?.odusId) {
    console.log(`[Recovery] Cannot recover - no player odusId`)
    return false
  }

  const odusId = client.player.odusId

  // Check President games first
  for (const [gameId, game] of presidentGames) {
    const playerInfo = game.getPlayerInfo(odusId)
    if (playerInfo) {
      console.log(`[Recovery] Restored gameId for ${client.player.nickname} in President game ${gameId}`)
      client.gameId = gameId
      return true
    }
  }

  // Check Euchre games
  for (const [gameId, game] of games) {
    const playerInfo = game.getPlayerInfo(odusId)
    if (playerInfo) {
      console.log(`[Recovery] Restored gameId for ${client.player.nickname} in Euchre game ${gameId}`)
      client.gameId = gameId
      return true
    }
  }

  // Also check disconnectedPlayers - they might be reconnecting
  const disconnectedInfo = disconnectedPlayers.get(odusId)
  if (disconnectedInfo) {
    const elapsed = Date.now() - disconnectedInfo.disconnectTime
    console.log(`[Recovery] Found ${client.player.nickname} in disconnectedPlayers (elapsed: ${elapsed}ms, gameId: ${disconnectedInfo.gameId}, seat: ${disconnectedInfo.seatIndex})`)
    
    // Try to restore them to the game
    if (disconnectedInfo.gameType === 'president') {
      const game = presidentGames.get(disconnectedInfo.gameId)
      if (game) {
        const restored = game.restoreHumanPlayer(disconnectedInfo.seatIndex, odusId, client.player.nickname)
        if (restored) {
          client.gameId = disconnectedInfo.gameId
          disconnectedPlayers.delete(odusId)
          console.log(`[Recovery] Restored ${client.player.nickname} to President game via disconnectedPlayers`)
          return true
        }
      }
    } else {
      const game = games.get(disconnectedInfo.gameId)
      if (game) {
        const restored = game.restoreHumanPlayer(disconnectedInfo.seatIndex, odusId, client.player.nickname)
        if (restored) {
          client.gameId = disconnectedInfo.gameId
          disconnectedPlayers.delete(odusId)
          console.log(`[Recovery] Restored ${client.player.nickname} to Euchre game via disconnectedPlayers`)
          return true
        }
      }
    }
  }

  console.log(`[Recovery] Failed to find game for ${client.player.nickname} (odusId: ${odusId}) - President games: ${presidentGames.size}, Euchre games: ${games.size}`)
  return false
}

function handleMakeBid(ws: WebSocket, client: ConnectedClient, action: Bid['action'], suit?: Bid['suit'], goingAlone?: boolean): void {
  // If this action was queued and the client disconnected before execution, bail out
  if (!clients.has(ws)) return

  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_player_bid' })
    return
  }
  if (!client.gameId && !ensureGameIdRecovered(client)) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_game_bid' })
    return
  }

  const game = games.get(client.gameId!)
  if (!game) {
    send(ws, { type: 'error', message: 'Game not found' })
    return
  }

  const success = game.handleBid(client.player.odusId, action, suit, goingAlone)
  if (!success) {
    send(ws, { type: 'error', message: 'Invalid bid' })
  }
}

function handlePlayCard(ws: WebSocket, client: ConnectedClient, cardId: string): void {
  // If this action was queued and the client disconnected before execution, bail out
  if (!clients.has(ws)) return

  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_player_play' })
    return
  }
  if (!client.gameId && !ensureGameIdRecovered(client)) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_game_play' })
    return
  }

  const game = games.get(client.gameId!)
  if (!game) {
    send(ws, { type: 'error', message: 'Game not found' })
    return
  }

  const success = game.handlePlayCard(client.player.odusId, cardId)
  if (!success) {
    send(ws, { type: 'error', message: 'Invalid card play' })
  }
}

function handleDiscardCard(ws: WebSocket, client: ConnectedClient, cardId: string): void {
  // If this action was queued and the client disconnected before execution, bail out
  if (!clients.has(ws)) return

  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_player_discard' })
    return
  }
  if (!client.gameId && !ensureGameIdRecovered(client)) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_game_discard' })
    return
  }

  const game = games.get(client.gameId!)
  if (!game) {
    send(ws, { type: 'error', message: 'Game not found' })
    return
  }

  const success = game.handleDealerDiscard(client.player.odusId, cardId)
  if (!success) {
    send(ws, { type: 'error', message: 'Invalid discard' })
  }
}

function handleBootPlayer(ws: WebSocket, client: ConnectedClient, playerId: number): void {
  // If this action was queued and the client disconnected before execution, bail out
  if (!clients.has(ws)) return

  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_player_boot' })
    return
  }
  if (!client.gameId && !ensureGameIdRecovered(client)) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_game_boot' })
    return
  }

  const gameType = gameTypes.get(client.gameId!)
  let success = false

  if (gameType === 'president') {
    const presidentGame = presidentGames.get(client.gameId!)
    if (!presidentGame) {
      send(ws, { type: 'error', message: 'Game not found' })
      return
    }
    success = presidentGame.bootPlayer(playerId)
  } else {
    const game = games.get(client.gameId!)
    if (!game) {
      send(ws, { type: 'error', message: 'Game not found' })
      return
    }
    success = game.bootPlayer(playerId)
  }

  // Any player can boot a timed-out player
  // bootPlayer() returns false if player isn't timed out or already booted
  if (!success) {
    // Silently ignore - likely a race condition where another player already booted them
    console.log(`Boot request for player ${playerId} ignored (not timed out or already booted)`)
  }
}

function handlePresidentPlayCards(ws: WebSocket, client: ConnectedClient, cardIds: string[]): void {
  // If this action was queued and the client disconnected before execution, bail out
  if (!clients.has(ws)) return

  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_player_pres_play' })
    return
  }
  if (!client.gameId && !ensureGameIdRecovered(client)) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_game_pres_play' })
    return
  }

  const presidentGame = presidentGames.get(client.gameId!)
  if (!presidentGame) {
    send(ws, { type: 'error', message: 'President game not found' })
    return
  }

  const success = presidentGame.handlePlayCards(client.player.odusId, cardIds)
  if (!success) {
    send(ws, { type: 'error', message: 'Invalid card play' })
  }
}

function handlePresidentPass(ws: WebSocket, client: ConnectedClient): void {
  // If this action was queued and the client disconnected before execution, bail out
  if (!clients.has(ws)) return

  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_player_pres_pass' })
    return
  }
  if (!client.gameId && !ensureGameIdRecovered(client)) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_game_pres_pass' })
    return
  }

  const presidentGame = presidentGames.get(client.gameId!)
  if (!presidentGame) {
    send(ws, { type: 'error', message: 'President game not found' })
    return
  }

  const success = presidentGame.handlePass(client.player.odusId)
  if (!success) {
    send(ws, { type: 'error', message: 'Cannot pass right now' })
  }
}

function handlePresidentGiveCards(ws: WebSocket, client: ConnectedClient, cardIds: string[]): void {
  // If this action was queued and the client disconnected before execution, bail out
  if (!clients.has(ws)) return

  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_player_pres_give' })
    return
  }
  if (!client.gameId && !ensureGameIdRecovered(client)) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'no_game_pres_give' })
    return
  }

  const presidentGame = presidentGames.get(client.gameId!)
  if (!presidentGame) {
    send(ws, { type: 'error', message: 'President game not found' })
    return
  }

  const success = presidentGame.handleGiveCards(client.player.odusId, cardIds)
  if (!success) {
    send(ws, { type: 'error', message: 'Invalid card selection' })
  }
}

function replacePlayerWithAI(client: ConnectedClient, trackForReconnect: boolean = false): void {
  if (!client.player || !client.gameId) return

  const odusId = client.player.odusId
  const gameId = client.gameId
  const gameType = gameTypes.get(gameId) || 'euchre'

  if (gameType === 'president') {
    const game = presidentGames.get(gameId)
    if (!game) return
    const idx = game.findPlayerIndexByOdusId(odusId)
    if (idx >= 0) {
      // Track for reconnection before replacing
      if (trackForReconnect) {
        disconnectedPlayers.set(odusId, {
          gameId,
          seatIndex: idx,
          gameType: 'president',
          disconnectTime: Date.now(),
        })
        console.log(`Tracking ${client.player.nickname} for reconnection (President, seat ${idx})`)
      }
      game.replaceWithAI(idx)
    }
  } else {
    const game = games.get(gameId)
    if (!game) return
    const idx = game.findPlayerIndexByOdusId(odusId)
    if (idx >= 0) {
      // Track for reconnection before replacing
      if (trackForReconnect) {
        disconnectedPlayers.set(odusId, {
          gameId,
          seatIndex: idx,
          gameType: 'euchre',
          disconnectTime: Date.now(),
        })
        console.log(`Tracking ${client.player.nickname} for reconnection (Euchre, seat ${idx})`)
      }
      game.replaceWithAI(idx)
    }
  }

  client.gameId = null
}

function handleLeaveGame(ws: WebSocket, client: ConnectedClient): void {
  // If this action was queued and the client disconnected before execution, bail out
  if (!clients.has(ws)) return

  // Voluntary leave - don't track for reconnection
  replacePlayerWithAI(client, false)
}

function handleMessage(ws: WebSocket, client: ConnectedClient, message: ClientMessage): void {
  if (isDuplicateCommand(client, message.commandId)) {
    console.warn('Ignoring duplicate command', message.type, message.commandId)
    return
  }

  if (typeof message.clientSeq === 'number') {
    if (client.lastClientSeq !== undefined && message.clientSeq <= client.lastClientSeq) {
      console.warn('Ignoring duplicate/out-of-order client message', message.type, message.clientSeq)
      return
    }
    client.lastClientSeq = message.clientSeq
  }

  if (typeof message.expectedStateSeq === 'number' && client.gameId) {
    const currentSeq = getCurrentStateSeq(client.gameId)
    if (currentSeq !== null && message.expectedStateSeq !== currentSeq) {
      send(ws, { type: 'error', message: 'State out of date. Resyncing.', code: 'sync_required' })
      sessionHandlers.handleRequestState(ws, client)
      return
    }
  }

  const routeGameCommand = (action: () => void) => {
    if (client.gameId) {
      enqueueGameCommand(client.gameId, action)
    } else {
      action()
    }
  }

  routeClientMessage(ws, client, message, {
    joinLobby: lobbyHandlers.handleJoinLobby,
    createTable: lobbyHandlers.handleCreateTable,
    joinTable: lobbyHandlers.handleJoinTable,
    leaveTable: lobbyHandlers.handleLeaveTable,
    leaveGame: (socket, c) => routeGameCommand(() => handleLeaveGame(socket, c)),
    startGame: sessionHandlers.handleStartGame,
    restartGame: sessionHandlers.handleRestartGame,
    makeBid: (socket, c, action, suit, goingAlone) => routeGameCommand(() => handleMakeBid(socket, c, action, suit, goingAlone)),
    playCard: (socket, c, cardId) => routeGameCommand(() => handlePlayCard(socket, c, cardId)),
    discardCard: (socket, c, cardId) => routeGameCommand(() => handleDiscardCard(socket, c, cardId)),
    requestState: (socket, c) => routeGameCommand(() => sessionHandlers.handleRequestState(socket, c)),
    presidentPlayCards: (socket, c, cardIds) => routeGameCommand(() => handlePresidentPlayCards(socket, c, cardIds)),
    presidentPass: (socket, c) => routeGameCommand(() => handlePresidentPass(socket, c)),
    presidentGiveCards: (socket, c, cardIds) => routeGameCommand(() => handlePresidentGiveCards(socket, c, cardIds)),
    bootPlayer: (socket, c, playerId) => routeGameCommand(() => handleBootPlayer(socket, c, playerId)),
    bugReport: async (socket, c, payload) => {
      const clientId = c.player?.odusId ?? 'unknown'
      const result = await handleBugReport(clientId, payload)
      send(socket, { type: 'bug_report_ack', success: result.success, issueUrl: result.issueUrl })
    },
    unknownMessage: (socket) => send(socket, { type: 'error', message: 'Unknown message type' }),
  })
}

// ============================================
// Server Setup
// ============================================

const { app } = createWebSocketServer({
  port: PORT,
  onConnection: (ws: WebSocket) => {
    const client: ConnectedClient = {
      ws,
      player: null,
      tableId: null,
      gameId: null,
    }
    clients.set(ws, client)

    console.log(`Client connected. Total: ${clients.size}`)
  },
  onMessage: (ws: WebSocket, data: Buffer) => {
    const client = clients.get(ws)
    if (!client) return

    try {
      const parsed = JSON.parse(data.toString()) as unknown
      const validation = parseClientMessage(parsed)
      if (!validation.success) {
        console.warn('Rejected client message:', validation.error)
        send(ws, { type: 'error', message: 'Invalid message format' })
        return
      }
      handleMessage(ws, client, validation.message)
    } catch (error) {
      console.error('Failed to parse message:', error)
      send(ws, { type: 'error', message: 'Invalid message format' })
    }
  },
  onClose: (ws: WebSocket) => {
    const client = clients.get(ws)
    if (!client) return
    // Handle disconnect - leave table if at one
    if (client.tableId) {
      lobbyHandlers.handleLeaveTable(ws, client)
    }
    // Replace disconnected player with AI if they were in a game
    // Track for reconnection so they can rejoin within the grace period
    if (client.gameId && client.player) {
      const odusId = client.player.odusId
      const nickname = client.player.nickname

      // Helper to check if player has reconnected on another WebSocket
      const checkHasReconnected = (): boolean => {
        for (const [otherWs, otherClient] of clients) {
          if (otherWs !== ws && otherClient.player?.odusId === odusId) {
            return true
          }
        }
        return false
      }

      // Check immediately first
      if (checkHasReconnected()) {
        console.log(`Skipping AI replacement for ${odusId} - already reconnected`)
      } else {
        // Delay AI replacement to allow pending join_lobby messages to be processed.
        // This fixes a race condition where:
        // 1. New WebSocket connects (client created with player: null)
        // 2. New client sends join_lobby (queued for processing)
        // 3. Old WebSocket's onClose fires (this handler)
        // 4. hasReconnected check fails because otherClient.player is still null
        // 5. Player gets replaced by AI prematurely
        // The 500ms delay allows the event loop to process pending messages.
        setTimeout(() => {
          if (checkHasReconnected()) {
            console.log(`Skipping AI replacement for ${odusId} - reconnected during grace period`)
          } else {
            console.log(`Replacing ${nickname} (${odusId}) with AI after disconnect grace period`)
            replacePlayerWithAI(client, true)
          }
        }, 500)
      }
    }
    clients.delete(ws)
    console.log(`Client disconnected. Total: ${clients.size}`)
  },
  onError: (_ws: WebSocket, error: Error) => {
    console.error('WebSocket error:', error)
  },
})

// HTTP endpoint for bug reports (works without websocket connection)
app.post('/api/bug-report', async (req, res) => {
  try {
    const payload = JSON.stringify(req.body)
    const result = await handleBugReport('http-client', payload)
    res.json(result)
  } catch (error) {
    console.error('[HTTP BugReport] Error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', clients: clients.size })
})

console.log(`Euchre/President HTTP + WebSocket server running on port ${PORT}`)
