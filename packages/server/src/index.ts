import { WebSocketServer, WebSocket } from 'ws'
import type {
  ClientMessage,
  ServerMessage,
  LobbyPlayer,
  Table,
  LobbyState,
  ClientGameState,
  TeamScore,
  Card,
  Bid,
} from '@euchre/shared'
import { Game } from './Game.js'

const PORT = parseInt(process.env.PORT || '3001', 10)

// ============================================
// Types
// ============================================

interface ConnectedClient {
  ws: WebSocket
  player: LobbyPlayer | null
  tableId: string | null
  gameId: string | null
}

// ============================================
// State
// ============================================

const clients = new Map<WebSocket, ConnectedClient>()
const tables = new Map<string, Table>()
const games = new Map<string, Game>()
const gameHosts = new Map<string, string>() // gameId -> hostOdusId

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

function getLobbyState(): LobbyState {
  return {
    tables: Array.from(tables.values()),
    connectedPlayers: clients.size,
  }
}

// ============================================
// Message Handlers
// ============================================

function handleJoinLobby(ws: WebSocket, client: ConnectedClient, nickname: string, odusId?: string): void {
  const playerId = odusId || generateId()

  client.player = {
    odusId: playerId,
    nickname,
    connectedAt: Date.now(),
  }

  // Send welcome with assigned/confirmed ID
  send(ws, {
    type: 'welcome',
    odusId: playerId,
    nickname,
  })

  // Send current lobby state
  send(ws, {
    type: 'lobby_state',
    state: getLobbyState(),
  })

  console.log(`Player joined lobby: ${nickname} (${playerId})`)
}

function handleCreateTable(ws: WebSocket, client: ConnectedClient, tableName?: string): void {
  if (!client.player) {
    send(ws, { type: 'error', message: 'Must join lobby first' })
    return
  }

  if (client.tableId) {
    send(ws, { type: 'error', message: 'Already at a table' })
    return
  }

  const tableId = generateId()
  const table: Table = {
    odusId: tableId,
    name: tableName || `Table ${tableId}`,
    seats: [
      { odusIndex: 0, player: client.player, isHost: true },
      { odusIndex: 1, player: null, isHost: false },
      { odusIndex: 2, player: null, isHost: false },
      { odusIndex: 3, player: null, isHost: false },
    ],
    hostId: client.player.odusId,
    createdAt: Date.now(),
  }

  tables.set(tableId, table)
  client.tableId = tableId

  // Confirm to creator
  send(ws, {
    type: 'joined_table',
    table,
    seatIndex: 0,
  })

  // Broadcast table creation to lobby
  broadcast({ type: 'table_updated', table }, ws)

  console.log(`Table created: ${table.name} by ${client.player.nickname}`)
}

function handleJoinTable(ws: WebSocket, client: ConnectedClient, tableId: string, seatIndex: number): void {
  if (!client.player) {
    send(ws, { type: 'error', message: 'Must join lobby first' })
    return
  }

  if (client.tableId) {
    send(ws, { type: 'error', message: 'Already at a table' })
    return
  }

  const table = tables.get(tableId)
  if (!table) {
    send(ws, { type: 'error', message: 'Table not found' })
    return
  }

  if (seatIndex < 0 || seatIndex > 3) {
    send(ws, { type: 'error', message: 'Invalid seat index' })
    return
  }

  const seat = table.seats[seatIndex]
  if (seat?.player) {
    send(ws, { type: 'error', message: 'Seat is occupied' })
    return
  }

  // Assign player to seat
  table.seats[seatIndex] = {
    odusIndex: seatIndex,
    player: client.player,
    isHost: false,
  }
  client.tableId = tableId

  // Confirm to joiner
  send(ws, {
    type: 'joined_table',
    table,
    seatIndex,
  })

  // Notify others at table
  broadcastToTable(tableId, {
    type: 'player_joined',
    seatIndex,
    player: client.player,
  }, ws)

  // Broadcast table update to lobby
  broadcast({ type: 'table_updated', table })

  console.log(`${client.player.nickname} joined ${table.name} at seat ${seatIndex}`)
}

function handleLeaveTable(ws: WebSocket, client: ConnectedClient): void {
  if (!client.player || !client.tableId) {
    send(ws, { type: 'error', message: 'Not at a table' })
    return
  }

  const table = tables.get(client.tableId)
  if (!table) {
    client.tableId = null
    return
  }

  // Find and clear the player's seat
  const seatIndex = table.seats.findIndex(s => s.player?.odusId === client.player?.odusId)
  if (seatIndex !== -1) {
    table.seats[seatIndex] = {
      odusIndex: seatIndex,
      player: null,
      isHost: false,
    }
  }

  const wasHost = table.hostId === client.player.odusId
  const playerName = client.player.nickname

  // Notify others at table
  broadcastToTable(client.tableId, {
    type: 'player_left',
    seatIndex,
    playerId: client.player.odusId,
    replacedWithAI: false,
  }, ws)

  // If host left, assign new host or delete table
  const remainingPlayers = table.seats.filter(s => s.player !== null)
  if (remainingPlayers.length === 0) {
    // Delete empty table
    tables.delete(client.tableId)
    broadcast({ type: 'table_removed', tableId: client.tableId })
    console.log(`Table ${table.name} deleted (empty)`)
  } else if (wasHost) {
    // Assign new host
    const newHost = remainingPlayers[0]!
    table.hostId = newHost.player!.odusId
    newHost.isHost = true
    broadcast({ type: 'table_updated', table })
    console.log(`New host for ${table.name}: ${newHost.player!.nickname}`)
  } else {
    broadcast({ type: 'table_updated', table })
  }

  // Confirm to leaver
  send(ws, { type: 'left_table' })
  client.tableId = null

  console.log(`${playerName} left ${table.name}`)
}

function handleStartGame(ws: WebSocket, client: ConnectedClient): void {
  if (!client.player || !client.tableId) {
    send(ws, { type: 'error', message: 'Not at a table' })
    return
  }

  const table = tables.get(client.tableId)
  if (!table) {
    send(ws, { type: 'error', message: 'Table not found' })
    return
  }

  if (table.hostId !== client.player.odusId) {
    send(ws, { type: 'error', message: 'Only host can start game' })
    return
  }

  const gameId = generateId()
  const tableId = client.tableId

  // Collect human players from the table
  const humanPlayers: Array<{ odusId: string; name: string; seatIndex: number }> = []
  for (const seat of table.seats) {
    if (seat.player) {
      humanPlayers.push({
        odusId: seat.player.odusId,
        name: seat.player.nickname,
        seatIndex: seat.odusIndex,
      })
    }
  }

  // Create game with event handlers
  const game = new Game(gameId, {
    onStateChange: (playerId: string | null, state: ClientGameState) => {
      if (playerId) {
        sendToPlayer(playerId, { type: 'game_state', state })
      }
    },
    onBidMade: (playerId: number, bid: Bid, playerName: string) => {
      broadcastToGame(gameId, {
        type: 'bid_made',
        playerId,
        action: bid.action,
        suit: bid.suit,
        goingAlone: bid.goingAlone,
        playerName,
      })
    },
    onCardPlayed: (playerId: number, card: Card, playerName: string) => {
      broadcastToGame(gameId, {
        type: 'card_played',
        playerId,
        card,
        playerName,
      })
    },
    onTrickComplete: (winnerId: number, winnerName: string, cards: Array<{ playerId: number; card: Card }>) => {
      broadcastToGame(gameId, {
        type: 'trick_complete',
        winnerId,
        winnerName,
        cards,
      })
    },
    onRoundComplete: (scores: TeamScore[], tricksTaken: [number, number], pointsAwarded: [number, number]) => {
      broadcastToGame(gameId, {
        type: 'round_complete',
        scores,
        tricksTaken,
        pointsAwarded,
      })
    },
    onGameOver: (winningTeam: number, finalScores: TeamScore[]) => {
      broadcastToGame(gameId, {
        type: 'game_over',
        winningTeam,
        finalScores,
      })
    },
    onYourTurn: (playerId: string, validActions: string[], validCards?: string[]) => {
      sendToPlayer(playerId, {
        type: 'your_turn',
        validActions,
        validCards,
      })
    },
    onTurnReminder: (playerId: string, validActions: string[], validCards?: string[]) => {
      sendToPlayer(playerId, {
        type: 'turn_reminder',
        validActions,
        validCards,
      })
    },
    onPlayerTimedOut: (playerId: number, playerName: string) => {
      broadcastToGame(gameId, {
        type: 'player_timed_out',
        playerId,
        playerName,
      })
    },
    onPlayerBooted: (playerId: number, playerName: string) => {
      broadcastToGame(gameId, {
        type: 'player_booted',
        playerId,
        playerName,
        replacedWithAI: true,
      })
    },
  })

  game.initializePlayers(humanPlayers)
  games.set(gameId, game)
  gameHosts.set(gameId, table.hostId) // Track who the host is

  // Update all clients at table to be in game
  for (const [clientWs, c] of clients) {
    if (c.tableId === tableId) {
      c.gameId = gameId
      c.tableId = null
    }
  }

  console.log(`Starting game ${gameId} at table ${table.name}`)

  // Send game_started to all players
  broadcastToGame(gameId, {
    type: 'game_started',
    gameId,
  })

  // Remove table from lobby
  tables.delete(tableId)
  broadcast({ type: 'table_removed', tableId })

  // Start the game
  game.start()
}

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

function handleRequestState(ws: WebSocket, client: ConnectedClient): void {
  if (!client.player || !client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game' })
    return
  }

  const game = games.get(client.gameId)
  if (!game) {
    send(ws, { type: 'error', message: 'Game not found' })
    return
  }

  // Resend the current game state to this player
  game.resendStateToPlayer(client.player.odusId)
  console.log(`Resent state to ${client.player.nickname} (requested resync)`)
}

function handleBootPlayer(ws: WebSocket, client: ConnectedClient, playerId: number): void {
  if (!client.player || !client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game' })
    return
  }

  const game = games.get(client.gameId)
  if (!game) {
    send(ws, { type: 'error', message: 'Game not found' })
    return
  }

  // Any player can boot a timed-out player
  // bootPlayer() returns false if player isn't timed out or already booted
  const success = game.bootPlayer(playerId)
  if (!success) {
    // Silently ignore - likely a race condition where another player already booted them
    console.log(`Boot request for player ${playerId} ignored (not timed out or already booted)`)
  }
}

function handleRestartGame(ws: WebSocket, client: ConnectedClient): void {
  if (!client.player || !client.gameId) {
    send(ws, { type: 'error', message: 'Not in a game' })
    return
  }

  const oldGameId = client.gameId
  const hostId = gameHosts.get(oldGameId)

  if (!hostId) {
    send(ws, { type: 'error', message: 'Game host not found' })
    return
  }

  // Only host can restart
  if (client.player.odusId !== hostId) {
    send(ws, { type: 'error', message: 'Only host can restart game' })
    return
  }

  const oldGame = games.get(oldGameId)
  if (!oldGame) {
    send(ws, { type: 'error', message: 'Game not found' })
    return
  }

  // Collect all human players currently in the game
  const humanPlayers: Array<{ odusId: string; name: string; seatIndex: number }> = []
  for (const [, c] of clients) {
    if (c.gameId === oldGameId && c.player) {
      // Find their seat index from the old game
      const playerInfo = oldGame.getPlayerInfo(c.player.odusId)
      if (playerInfo) {
        humanPlayers.push({
          odusId: c.player.odusId,
          name: c.player.nickname,
          seatIndex: playerInfo.seatIndex,
        })
      }
    }
  }

  // Notify all players that game is restarting
  broadcastToGame(oldGameId, { type: 'game_restarting' })

  // Create new game
  const newGameId = generateId()

  const newGame = new Game(newGameId, {
    onStateChange: (playerId: string | null, state: ClientGameState) => {
      if (playerId) {
        sendToPlayer(playerId, { type: 'game_state', state })
      }
    },
    onBidMade: (playerId: number, bid: Bid, playerName: string) => {
      broadcastToGame(newGameId, {
        type: 'bid_made',
        playerId,
        action: bid.action,
        suit: bid.suit,
        goingAlone: bid.goingAlone,
        playerName,
      })
    },
    onCardPlayed: (playerId: number, card: Card, playerName: string) => {
      broadcastToGame(newGameId, {
        type: 'card_played',
        playerId,
        card,
        playerName,
      })
    },
    onTrickComplete: (winnerId: number, winnerName: string, cards: Array<{ playerId: number; card: Card }>) => {
      broadcastToGame(newGameId, {
        type: 'trick_complete',
        winnerId,
        winnerName,
        cards,
      })
    },
    onRoundComplete: (scores: TeamScore[], tricksTaken: [number, number], pointsAwarded: [number, number]) => {
      broadcastToGame(newGameId, {
        type: 'round_complete',
        scores,
        tricksTaken,
        pointsAwarded,
      })
    },
    onGameOver: (winningTeam: number, finalScores: TeamScore[]) => {
      broadcastToGame(newGameId, {
        type: 'game_over',
        winningTeam,
        finalScores,
      })
    },
    onYourTurn: (playerId: string, validActions: string[], validCards?: string[]) => {
      sendToPlayer(playerId, {
        type: 'your_turn',
        validActions,
        validCards,
      })
    },
    onTurnReminder: (playerId: string, validActions: string[], validCards?: string[]) => {
      sendToPlayer(playerId, {
        type: 'turn_reminder',
        validActions,
        validCards,
      })
    },
    onPlayerTimedOut: (playerId: number, playerName: string) => {
      broadcastToGame(newGameId, {
        type: 'player_timed_out',
        playerId,
        playerName,
      })
    },
    onPlayerBooted: (playerId: number, playerName: string) => {
      broadcastToGame(newGameId, {
        type: 'player_booted',
        playerId,
        playerName,
        replacedWithAI: true,
      })
    },
  })

  newGame.initializePlayers(humanPlayers)
  games.set(newGameId, newGame)
  gameHosts.set(newGameId, hostId)

  // Update all clients to the new game
  for (const [, c] of clients) {
    if (c.gameId === oldGameId) {
      c.gameId = newGameId
    }
  }

  // Clean up old game
  games.delete(oldGameId)
  gameHosts.delete(oldGameId)

  console.log(`Game restarted: ${oldGameId} -> ${newGameId}`)

  // Send game_started to all players
  broadcastToGame(newGameId, {
    type: 'game_started',
    gameId: newGameId,
  })

  // Start the new game
  newGame.start()
}

function handleMessage(ws: WebSocket, client: ConnectedClient, message: ClientMessage): void {
  switch (message.type) {
    case 'join_lobby':
      handleJoinLobby(ws, client, message.nickname, message.odusId)
      break
    case 'create_table':
      handleCreateTable(ws, client, message.tableName)
      break
    case 'join_table':
      handleJoinTable(ws, client, message.tableId, message.seatIndex)
      break
    case 'leave_table':
      handleLeaveTable(ws, client)
      break
    case 'start_game':
      handleStartGame(ws, client)
      break
    case 'restart_game':
      handleRestartGame(ws, client)
      break
    case 'make_bid':
      handleMakeBid(ws, client, message.action, message.suit, message.goingAlone)
      break
    case 'play_card':
      handlePlayCard(ws, client, message.cardId)
      break
    case 'discard_card':
      handleDiscardCard(ws, client, message.cardId)
      break
    case 'request_state':
      handleRequestState(ws, client)
      break
    case 'boot_player':
      handleBootPlayer(ws, client, message.playerId)
      break
    default:
      send(ws, { type: 'error', message: 'Unknown message type' })
  }
}

// ============================================
// Server Setup
// ============================================

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (ws: WebSocket) => {
  const client: ConnectedClient = {
    ws,
    player: null,
    tableId: null,
    gameId: null,
  }
  clients.set(ws, client)

  console.log(`Client connected. Total: ${clients.size}`)

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage
      handleMessage(ws, client, message)
    } catch (error) {
      console.error('Failed to parse message:', error)
      send(ws, { type: 'error', message: 'Invalid message format' })
    }
  })

  ws.on('close', () => {
    // Handle disconnect - leave table if at one
    if (client.tableId) {
      handleLeaveTable(ws, client)
    }
    // TODO: Handle game disconnect (replace with AI, hold seat for reconnect)
    clients.delete(ws)
    console.log(`Client disconnected. Total: ${clients.size}`)
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
  })
})

console.log(`Euchre WebSocket server running on port ${PORT}`)
