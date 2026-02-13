import type { WebSocket } from 'ws'
import type {
  LobbyState,
  Table,
  TableSettings,
  GameType,
  ServerMessage,
} from '@euchre/shared'
import type { Game } from '../Game.js'
import type { PresidentGame } from '../PresidentGame.js'
import type { ConnectedClient } from '../ws/types.js'

export interface LobbyHandlers {
  handleJoinLobby: (ws: WebSocket, client: ConnectedClient, nickname: string, odusId?: string) => void
  handleCreateTable: (
    ws: WebSocket,
    client: ConnectedClient,
    tableName?: string,
    gameType?: GameType,
    maxPlayers?: number,
    settings?: TableSettings
  ) => void
  handleJoinTable: (ws: WebSocket, client: ConnectedClient, tableId: string, seatIndex: number) => void
  handleLeaveTable: (ws: WebSocket, client: ConnectedClient) => void
}

export interface DisconnectedPlayer {
  gameId: string
  seatIndex: number
  gameType: 'euchre' | 'president'
  disconnectTime: number
}

export interface LobbyDependencies {
  clients: Map<WebSocket, ConnectedClient>
  tables: Map<string, Table>
  games: Map<string, Game>
  presidentGames: Map<string, PresidentGame>
  disconnectedPlayers: Map<string, DisconnectedPlayer>
  generateId: () => string
  send: (ws: WebSocket, message: ServerMessage) => void
  broadcast: (message: ServerMessage, excludeWs?: WebSocket) => void
  broadcastToTable: (tableId: string, message: ServerMessage, excludeWs?: WebSocket) => void
}

// Grace period for reconnection (5 minutes)
const RECONNECT_GRACE_PERIOD_MS = 5 * 60 * 1000

export function createLobbyHandlers(deps: LobbyDependencies): LobbyHandlers {
  const {
    clients,
    tables,
    games,
    presidentGames,
    disconnectedPlayers,
    generateId,
    send,
    broadcast,
    broadcastToTable,
  } = deps

  function getLobbyState(): LobbyState {
    return {
      tables: Array.from(tables.values()),
      connectedPlayers: clients.size,
    }
  }

  function handleJoinLobby(ws: WebSocket, client: ConnectedClient, nickname: string, odusId?: string): void {
    const playerId = odusId || generateId()

    client.player = {
      odusId: playerId,
      nickname,
      connectedAt: Date.now(),
    }

    // Check if this player is in an active game (reconnecting)
    let reconnectedToGame = false
    
    // First, check if they disconnected recently and their seat was converted to AI
    const disconnectedInfo = disconnectedPlayers.get(playerId)
    if (disconnectedInfo) {
      const elapsed = Date.now() - disconnectedInfo.disconnectTime
      if (elapsed <= RECONNECT_GRACE_PERIOD_MS) {
        // Try to restore their seat
        if (disconnectedInfo.gameType === 'president') {
          const game = presidentGames.get(disconnectedInfo.gameId)
          if (game) {
            const restored = game.restoreHumanPlayer(disconnectedInfo.seatIndex, playerId, nickname)
            if (restored) {
              client.gameId = disconnectedInfo.gameId
              console.log(`Player ${nickname} restored to President game ${disconnectedInfo.gameId} at seat ${disconnectedInfo.seatIndex}`)
              reconnectedToGame = true
              game.resendStateToPlayer(playerId)
            }
          }
        } else {
          const game = games.get(disconnectedInfo.gameId)
          if (game) {
            const restored = game.restoreHumanPlayer(disconnectedInfo.seatIndex, playerId, nickname)
            if (restored) {
              client.gameId = disconnectedInfo.gameId
              console.log(`Player ${nickname} restored to Euchre game ${disconnectedInfo.gameId} at seat ${disconnectedInfo.seatIndex}`)
              reconnectedToGame = true
              game.resendStateToPlayer(playerId)
            }
          }
        }
      }
      // Remove from disconnected players map (either restored or expired)
      disconnectedPlayers.delete(playerId)
    }
    
    // Also check if they're still in a game with their odusId intact (didn't disconnect long enough to be replaced)
    if (!reconnectedToGame) {
      for (const [gameId, game] of presidentGames) {
        const playerInfo = game.getPlayerInfo(playerId)
        if (playerInfo) {
          // Found their game - restore the connection
          client.gameId = gameId
          console.log(`Player ${nickname} reconnected to President game ${gameId}`)
          reconnectedToGame = true

          // Immediately send them the current game state
          game.resendStateToPlayer(playerId)
          break
        }
      }
    }

    // Also check regular games
    if (!reconnectedToGame) {
      for (const [gameId, game] of games) {
        const playerInfo = game.getPlayerInfo(playerId)
        if (playerInfo) {
          client.gameId = gameId
          console.log(`Player ${nickname} reconnected to Euchre game ${gameId}`)
          reconnectedToGame = true
          game.resendStateToPlayer(playerId)
          break
        }
      }
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

    console.log(`Player joined lobby: ${nickname} (${playerId})${reconnectedToGame ? ' [reconnected to game]' : ''}`)
  }

  function handleCreateTable(
    ws: WebSocket,
    client: ConnectedClient,
    tableName?: string,
    gameType: GameType = 'euchre',
    maxPlayers?: number,
    settings?: TableSettings
  ): void {
    if (!client.player) {
      send(ws, { type: 'error', message: 'Must join lobby first' })
      return
    }

    if (client.tableId) {
      send(ws, { type: 'error', message: 'Already at a table' })
      return
    }

    // Determine max players based on game type
    let actualMaxPlayers: number
    if (gameType === 'president') {
      actualMaxPlayers = maxPlayers ? Math.min(Math.max(maxPlayers, 4), 8) : 4
    } else {
      actualMaxPlayers = 4 // Euchre is always 4 players
    }

    const tableId = generateId()

    // Create seats based on max players
    const seats = []
    for (let i = 0; i < actualMaxPlayers; i++) {
      seats.push({
        odusIndex: i,
        player: i === 0 ? client.player : null,
        isHost: i === 0,
      })
    }

    const table: Table = {
      odusId: tableId,
      name: tableName || `Table ${tableId}`,
      seats,
      hostId: client.player.odusId,
      createdAt: Date.now(),
      gameType,
      maxPlayers: actualMaxPlayers,
      settings,
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

    if (seatIndex < 0 || seatIndex >= table.maxPlayers) {
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

  return {
    handleJoinLobby,
    handleCreateTable,
    handleJoinTable,
    handleLeaveTable,
  }
}