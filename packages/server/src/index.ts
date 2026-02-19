import type { WebSocket } from 'ws'
import type {
  ClientMessage,
  Table,
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
} from './sessions/registry.js'
import { createMessagingHelpers } from './orchestration/messaging.js'
import {
  hasAlreadyReconnected,
  logOrchestrationEvent,
  replacePlayerWithAI,
  tryRecoverGameId,
} from './orchestration/playerLifecycle.js'
import { createGameActionHandlers } from './orchestration/gameActions.js'

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

const { send, sendToPlayer, broadcast, broadcastToTable, broadcastToGame } =
  createMessagingHelpers(clients)

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

const gameActions = createGameActionHandlers({
  send,
  tryRecoverGameId,
  replacePlayerWithAI: (client, trackForReconnect = false) =>
    replacePlayerWithAI(client, disconnectedPlayers, trackForReconnect),
})

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
    leaveGame: (socket, c) => routeGameCommand(() => gameActions.handleLeaveGame(socket, c)),
    startGame: sessionHandlers.handleStartGame,
    restartGame: sessionHandlers.handleRestartGame,
    makeBid: (socket, c, action, suit, goingAlone) =>
      routeGameCommand(() => gameActions.handleMakeBid(socket, c, action, suit, goingAlone)),
    playCard: (socket, c, cardId) =>
      routeGameCommand(() => gameActions.handlePlayCard(socket, c, cardId)),
    discardCard: (socket, c, cardId) =>
      routeGameCommand(() => gameActions.handleDiscardCard(socket, c, cardId)),
    requestState: (socket, c) => routeGameCommand(() => sessionHandlers.handleRequestState(socket, c)),
    presidentPlayCards: (socket, c, cardIds) =>
      routeGameCommand(() => gameActions.handlePresidentPlayCards(socket, c, cardIds)),
    presidentPass: (socket, c) =>
      routeGameCommand(() => gameActions.handlePresidentPass(socket, c)),
    presidentConfirmExchange: (socket, c, cardIds) =>
      routeGameCommand(() => gameActions.handlePresidentConfirmExchange(socket, c, cardIds)),
    spadesMakeBid: (socket, c, bidType, count) =>
      routeGameCommand(() => gameActions.handleSpadesMakeBid(socket, c, bidType, count)),
    bootPlayer: (socket, c, playerId) =>
      routeGameCommand(() => gameActions.handleBootPlayer(socket, c, playerId)),
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
      if (!hasAlreadyReconnected(clients, ws, client)) {
        replacePlayerWithAI(client, disconnectedPlayers, true)
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
