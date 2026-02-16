import { WebSocket } from 'ws'
import type {
  ClientMessage,
  ServerMessage,
  Table,
  TeamScore,
  Card,
  Bid,
  SpadesBidType,
} from '@67cards/shared'
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
  spadesGames,
  getCurrentStateSeq,
  getRuntime,
  findRuntimeByPlayer,
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

function logOrchestrationEvent(event: string, details: Record<string, unknown>): void {
  console.info('[MP][orchestration]', {
    ts: Date.now(),
    event,
    ...details,
  })
}

const lobbyHandlers = createLobbyHandlers({
  clients,
  tables,
  games,
  presidentGames,
  spadesGames,
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
  generateId,
  send,
  sendToPlayer,
  broadcast,
  broadcastToGame,
})

/**
 * Attempt to recover a client's gameId if they're in a game but don't have gameId set.
 * This handles race conditions where reconnection doesn't properly restore the gameId.
 */
function tryRecoverGameId(client: ConnectedClient): boolean {
  if (!client.player || client.gameId) return false

  const odusId = client.player.odusId

  const runtimeEntry = findRuntimeByPlayer(odusId)
  if (runtimeEntry) {
    client.gameId = runtimeEntry.gameId
    console.log(
      `[Recovery] Restored gameId for ${client.player.nickname} -> ${runtimeEntry.entry.type} game ${runtimeEntry.gameId}`
    )
    return true
  }
  return false
}

function handleSpadesMakeBid(ws: WebSocket, client: ConnectedClient, bidType: 'normal' | 'nil' | 'blind_nil', count: number): void {
  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }

  if (!client.gameId) {
    tryRecoverGameId(client)
  }

  if (!client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }

  const spadesGame = spadesGames.get(client.gameId)
  if (!spadesGame) {
    send(ws, { type: 'error', message: 'Spades game not found' })
    return
  }

  const success = spadesGame.handleBid(client.player.odusId, { type: bidType as SpadesBidType, count })
  if (!success) {
    send(ws, { type: 'error', message: 'Invalid Spades bid' })
  }
}

function handleMakeBid(ws: WebSocket, client: ConnectedClient, action: Bid['action'], suit?: Bid['suit'], goingAlone?: boolean): void {
  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }
  
  // Try to recover gameId if missing (race condition during reconnection)
  if (!client.gameId) {
    tryRecoverGameId(client)
  }
  
  if (!client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }

  const game = games.get(client.gameId)
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
  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }
  
  if (!client.gameId) {
    tryRecoverGameId(client)
  }
  
  if (!client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }

  const runtimeEntry = getRuntime(client.gameId)
  if (!runtimeEntry) {
    send(ws, { type: 'error', message: 'Game not found', code: 'game_lost' })
    client.gameId = null
    return
  }

  const gameType = runtimeEntry.type
  let success = false

  if (gameType === 'spades') {
    const spadesGame = spadesGames.get(client.gameId)
    if (!spadesGame) {
      send(ws, { type: 'error', message: 'Game not found' })
      return
    }
    success = spadesGame.handlePlayCard(client.player.odusId, cardId)
  } else {
    const game = games.get(client.gameId)
    if (!game) {
      send(ws, { type: 'error', message: 'Game not found' })
      return
    }
    success = game.handlePlayCard(client.player.odusId, cardId)
  }

  if (!success) {
    send(ws, { type: 'error', message: 'Invalid card play' })
  }
}

function handleDiscardCard(ws: WebSocket, client: ConnectedClient, cardId: string): void {
  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }
  
  if (!client.gameId) {
    tryRecoverGameId(client)
  }
  
  if (!client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }

  const game = games.get(client.gameId)
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
  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }
  
  if (!client.gameId) {
    tryRecoverGameId(client)
  }
  
  if (!client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }

  const runtimeEntry = getRuntime(client.gameId)
  if (!runtimeEntry) {
    send(ws, { type: 'error', message: 'Game not found', code: 'game_lost' })
    client.gameId = null
    return
  }

  const gameType = runtimeEntry.type
  let success = false

  if (gameType === 'president') {
    const presidentGame = presidentGames.get(client.gameId)
    if (!presidentGame) {
      send(ws, { type: 'error', message: 'Game not found' })
      return
    }
    success = presidentGame.bootPlayer(playerId)
  } else if (gameType === 'spades') {
    const spadesGame = spadesGames.get(client.gameId)
    if (!spadesGame) {
      send(ws, { type: 'error', message: 'Game not found' })
      return
    }
    success = spadesGame.bootPlayer(playerId)
  } else {
    const game = games.get(client.gameId)
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
  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }
  
  if (!client.gameId) {
    tryRecoverGameId(client)
  }
  
  if (!client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }

  const presidentGame = presidentGames.get(client.gameId)
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
  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }
  
  if (!client.gameId) {
    tryRecoverGameId(client)
  }
  
  if (!client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }

  const presidentGame = presidentGames.get(client.gameId)
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
  if (!client.player) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }
  
  if (!client.gameId) {
    tryRecoverGameId(client)
  }
  
  if (!client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
    return
  }

  const presidentGame = presidentGames.get(client.gameId)
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
  const runtimeEntry = getRuntime(gameId)
  const gameType = runtimeEntry?.type || 'euchre'

  logOrchestrationEvent('replace_player_with_ai_start', {
    gameId,
    gameType,
    trackForReconnect,
    playerId: client.player.odusId,
    playerName: client.player.nickname,
  })

  if (runtimeEntry) {
    const idx = runtimeEntry.runtime.findPlayerIndexByOdusId(odusId)
    if (idx >= 0) {
      // Track for reconnection before replacing
      if (trackForReconnect) {
        disconnectedPlayers.set(odusId, {
          gameId,
          seatIndex: idx,
          gameType,
          disconnectTime: Date.now(),
        })
        console.log(`Tracking ${client.player.nickname} for reconnection (${gameType}, seat ${idx})`)
      }
      runtimeEntry.runtime.replaceWithAI(idx)
    }
    client.gameId = null
  } else {
    logOrchestrationEvent('replace_player_with_ai_missing_runtime', {
      gameId,
      playerId: client.player.odusId,
    })
    return
  }

  logOrchestrationEvent('replace_player_with_ai_done', {
    gameId,
    gameType,
    trackForReconnect,
    playerId: client.player.odusId,
  })
}

function handleLeaveGame(ws: WebSocket, client: ConnectedClient): void {
  // Voluntary leave - don't track for reconnection
  replacePlayerWithAI(client, false)
}

function handleMessage(ws: WebSocket, client: ConnectedClient, message: ClientMessage): void {
  logOrchestrationEvent('client_message_received', {
    messageType: message.type,
    gameId: client.gameId,
    gameType: client.gameId ? getRuntime(client.gameId)?.type ?? null : null,
    playerId: client.player?.odusId ?? null,
    clientSeq: message.clientSeq ?? null,
    expectedStateSeq: message.expectedStateSeq ?? null,
  })

  if (isDuplicateCommand(client, message.commandId)) {
    console.warn('Ignoring duplicate command', message.type, message.commandId)
    logOrchestrationEvent('client_message_duplicate', {
      messageType: message.type,
      commandId: message.commandId ?? null,
      playerId: client.player?.odusId ?? null,
    })
    return
  }

  if (typeof message.clientSeq === 'number') {
    if (client.lastClientSeq !== undefined && message.clientSeq <= client.lastClientSeq) {
      console.warn('Ignoring duplicate/out-of-order client message', message.type, message.clientSeq)
      logOrchestrationEvent('client_message_out_of_order', {
        messageType: message.type,
        messageClientSeq: message.clientSeq,
        lastClientSeq: client.lastClientSeq,
        playerId: client.player?.odusId ?? null,
      })
      return
    }
    client.lastClientSeq = message.clientSeq
  }

  if (typeof message.expectedStateSeq === 'number' && client.gameId) {
    const currentSeq = getCurrentStateSeq(client.gameId)
    if (currentSeq !== null && message.expectedStateSeq !== currentSeq) {
      logOrchestrationEvent('client_message_seq_mismatch', {
        messageType: message.type,
        gameId: client.gameId,
        expectedStateSeq: message.expectedStateSeq,
        currentStateSeq: currentSeq,
        playerId: client.player?.odusId ?? null,
      })
      send(ws, { type: 'error', message: 'State out of date. Resyncing.', code: 'sync_required' })
      sessionHandlers.handleRequestState(ws, client)
      return
    }
  }

  const routeGameCommand = (action: () => void) => {
    if (client.gameId) {
      logOrchestrationEvent('queue_game_command', {
        gameId: client.gameId,
        gameType: getRuntime(client.gameId)?.type ?? null,
        messageType: message.type,
      })
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
    spadesMakeBid: (socket, c, bidType, count) => routeGameCommand(() => handleSpadesMakeBid(socket, c, bidType, count)),
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
      // Check if another client has already reconnected with this odusId.
      // This prevents a race condition where the old connection's onClose fires
      // after the new connection has already re-established the player.
      let hasReconnected = false
      for (const [otherWs, otherClient] of clients) {
        if (otherWs !== ws &&
            otherClient.player?.odusId === client.player.odusId &&
            otherClient.gameId === client.gameId) {
          hasReconnected = true
          break
        }
      }

      if (!hasReconnected) {
        replacePlayerWithAI(client, true)
      } else {
        console.log(`Skipping AI replacement for ${client.player.odusId} - already reconnected`)
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
