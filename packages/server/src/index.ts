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
import { createLobbyHandlers } from './lobby/handlers.js'
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

function handleMakeBid(ws: WebSocket, client: ConnectedClient, action: Bid['action'], suit?: Bid['suit'], goingAlone?: boolean): void {
  if (!client.player || !client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game' })
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
  if (!client.player || !client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game' })
    return
  }

  const game = games.get(client.gameId)
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
  if (!client.player || !client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game' })
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
  if (!client.player || !client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game' })
    return
  }

  const gameType = gameTypes.get(client.gameId)
  let success = false

  if (gameType === 'president') {
    const presidentGame = presidentGames.get(client.gameId)
    if (!presidentGame) {
      send(ws, { type: 'error', message: 'Game not found' })
      return
    }
    success = presidentGame.bootPlayer(playerId)
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
  if (!client.player || !client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game' })
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
  if (!client.player || !client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game' })
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
  if (!client.player || !client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game' })
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

function replacePlayerWithAI(client: ConnectedClient): void {
  if (!client.player || !client.gameId) return

  const odusId = client.player.odusId
  const gameType = gameTypes.get(client.gameId)

  if (gameType === 'president') {
    const game = presidentGames.get(client.gameId)
    if (!game) return
    const idx = game.findPlayerIndexByOdusId(odusId)
    if (idx >= 0) game.replaceWithAI(idx)
  } else {
    const game = games.get(client.gameId)
    if (!game) return
    const idx = game.findPlayerIndexByOdusId(odusId)
    if (idx >= 0) game.replaceWithAI(idx)
  }

  client.gameId = null
}

function handleLeaveGame(ws: WebSocket, client: ConnectedClient): void {
  replacePlayerWithAI(client)
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
    if (client.gameId) {
      replacePlayerWithAI(client)
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
