import type { WebSocket } from 'ws'
import type {
  Bid,
  Card,
  ClientGameState,
  TeamScore,
  PresidentClientGameState,
  StandardCard,
  PlayerRank,
  PlayType,
  Table,
  ServerMessage,
} from '@euchre/shared'
import { Game } from '../Game.js'
import { PresidentGame } from '../PresidentGame.js'
import type { ConnectedClient } from '../ws/types.js'
import {
  games,
  presidentGames,
  gameHosts,
  gameTypes,
  gameSettings,
} from './registry.js'

export interface SessionHandlers {
  handleStartGame: (ws: WebSocket, client: ConnectedClient) => void
  handleRestartGame: (ws: WebSocket, client: ConnectedClient) => void
  handleRequestState: (ws: WebSocket, client: ConnectedClient) => void
}

export interface SessionDependencies {
  clients: Map<WebSocket, ConnectedClient>
  tables: Map<string, Table>
  generateId: () => string
  send: (ws: WebSocket, message: ServerMessage) => void
  sendToPlayer: (odusId: string, message: ServerMessage) => void
  broadcast: (message: ServerMessage, excludeWs?: WebSocket) => void
  broadcastToGame: (gameId: string, message: ServerMessage) => void
}

export function createSessionHandlers(deps: SessionDependencies): SessionHandlers {
  const {
    clients,
    tables,
    generateId,
    send,
    sendToPlayer,
    broadcast,
    broadcastToGame,
  } = deps

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
    const gameType = table.gameType || 'euchre'

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

    // Track game type
    gameTypes.set(gameId, gameType)
    gameHosts.set(gameId, table.hostId)
    gameSettings.set(gameId, table.settings)

    if (gameType === 'president') {
      // Create President game
      const superTwosMode = table.settings?.superTwosMode ?? false
      const presidentGame = new PresidentGame(gameId, {
        onStateChange: (playerId: string | null, state: PresidentClientGameState) => {
          if (playerId) {
            sendToPlayer(playerId, { type: 'president_game_state', state })
          }
        },
        onPlayMade: (playerId: number, cards: StandardCard[], playType: PlayType, playerName: string) => {
          broadcastToGame(gameId, {
            type: 'president_play_made',
            playerId,
            cards,
            playType,
            playerName,
          })
        },
        onPassed: (playerId: number, playerName: string) => {
          broadcastToGame(gameId, {
            type: 'president_passed',
            playerId,
            playerName,
          })
        },
        onPileCleared: (nextPlayerId: number) => {
          broadcastToGame(gameId, {
            type: 'president_pile_cleared',
            nextPlayerId,
          })
        },
        onPlayerFinished: (playerId: number, playerName: string, finishPosition: number, rank: PlayerRank) => {
          broadcastToGame(gameId, {
            type: 'president_player_finished',
            playerId,
            playerName,
            finishPosition,
            rank,
          })
        },
        onRoundComplete: (rankings: Array<{ playerId: number; rank: PlayerRank; name: string }>, roundNumber: number) => {
          broadcastToGame(gameId, {
            type: 'president_round_complete',
            rankings,
            roundNumber,
          })
        },
        onGameOver: (finalRankings: Array<{ playerId: number; name: string; rank: PlayerRank }>) => {
          broadcastToGame(gameId, {
            type: 'president_game_over',
            finalRankings,
          })
        },
        onCardExchangeInfo: (playerId: string, youGive: StandardCard[], youReceive: StandardCard[], otherPlayerName: string, yourRole: string) => {
          sendToPlayer(playerId, {
            type: 'president_card_exchange_info',
            youGive,
            youReceive,
            otherPlayerName,
            yourRole,
          })
        },
        onAwaitingGiveCards: (playerId: string, cardsToGive: number, receivedCards: StandardCard[], yourRole: string) => {
          sendToPlayer(playerId, {
            type: 'president_awaiting_give_cards',
            cardsToGive,
            receivedCards,
            yourRole,
          })
        },
        onYourTurn: (playerId: string, validActions: string[], validPlays: string[][]) => {
          sendToPlayer(playerId, {
            type: 'president_your_turn',
            validActions,
            validPlays,
          })
        },
        onTurnReminder: (playerId: string, validActions: string[], validPlays: string[][]) => {
          // Use the same message type for reminders
          sendToPlayer(playerId, {
            type: 'president_your_turn',
            validActions,
            validPlays,
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
      }, table.maxPlayers, superTwosMode)

      presidentGame.initializePlayers(humanPlayers)
      presidentGames.set(gameId, presidentGame)

      // Update all clients at table to be in game
      for (const [, c] of clients) {
        if (c.tableId === tableId) {
          c.gameId = gameId
          c.tableId = null
        }
      }

      console.log(`Starting President game ${gameId} at table ${table.name}`)

      // Send game_started to all players
      broadcastToGame(gameId, {
        type: 'game_started',
        gameId,
      })

      // Remove table from lobby
      tables.delete(tableId)
      broadcast({ type: 'table_removed', tableId })

      // Start the game
      presidentGame.start()
      return
    }

    // Create Euchre game with event handlers
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

    // Update all clients at table to be in game
    for (const [, c] of clients) {
      if (c.tableId === tableId) {
        c.gameId = gameId
        c.tableId = null
      }
    }

    console.log(`Starting Euchre game ${gameId} at table ${table.name}`)

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

  function handleRequestState(ws: WebSocket, client: ConnectedClient): void {
    if (!client.player || !client.gameId) {
      // Unrecoverable - tell client to bail
      send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
      return
    }

    const gameType = gameTypes.get(client.gameId)

    if (gameType === 'president') {
      const presidentGame = presidentGames.get(client.gameId)
      if (!presidentGame) {
        // Game was destroyed (server restart?) - tell client to bail
        send(ws, { type: 'error', message: 'Game not found', code: 'game_lost' })
        client.gameId = null  // Clear stale reference
        return
      }
      presidentGame.resendStateToPlayer(client.player.odusId)
    } else {
      const game = games.get(client.gameId)
      if (!game) {
        send(ws, { type: 'error', message: 'Game not found', code: 'game_lost' })
        client.gameId = null
        return
      }
      game.resendStateToPlayer(client.player.odusId)
    }

    console.log(`Resent state to ${client.player.nickname} (requested resync)`) 
  }

  function handleRestartGame(ws: WebSocket, client: ConnectedClient): void {
    if (!client.player || !client.gameId) {
      send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
      return
    }

    const oldGameId = client.gameId
    const hostId = gameHosts.get(oldGameId)
    const gameType = gameTypes.get(oldGameId) || 'euchre'
    const previousSettings = gameSettings.get(oldGameId)

    if (!hostId) {
      send(ws, { type: 'error', message: 'Game host not found' })
      return
    }

    // Only host can restart
    if (client.player.odusId !== hostId) {
      send(ws, { type: 'error', message: 'Only host can restart game' })
      return
    }

    // Get old game to find player info
    const oldEuchreGame = games.get(oldGameId)
    const oldPresidentGame = presidentGames.get(oldGameId)

    if (!oldEuchreGame && !oldPresidentGame) {
      send(ws, { type: 'error', message: 'Game not found' })
      return
    }

    // Collect all human players currently in the game
    const humanPlayers: Array<{ odusId: string; name: string; seatIndex: number }> = []
    for (const [, c] of clients) {
      if (c.gameId === oldGameId && c.player) {
        // Find their seat index from the old game
        const playerInfo = oldEuchreGame?.getPlayerInfo(c.player.odusId) ||
                           oldPresidentGame?.getPlayerInfo(c.player.odusId)
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
    gameTypes.set(newGameId, gameType)
    gameHosts.set(newGameId, hostId)
    gameSettings.set(newGameId, previousSettings)

    if (gameType === 'president') {
      // Create new President game
      const newPresidentGame = new PresidentGame(newGameId, {
        onStateChange: (playerId: string | null, state: PresidentClientGameState) => {
          if (playerId) {
            sendToPlayer(playerId, { type: 'president_game_state', state })
          }
        },
        onPlayMade: (playerId: number, cards: StandardCard[], playType: PlayType, playerName: string) => {
          broadcastToGame(newGameId, {
            type: 'president_play_made',
            playerId,
            cards,
            playType,
            playerName,
          })
        },
        onPassed: (playerId: number, playerName: string) => {
          broadcastToGame(newGameId, {
            type: 'president_passed',
            playerId,
            playerName,
          })
        },
        onPileCleared: (nextPlayerId: number) => {
          broadcastToGame(newGameId, {
            type: 'president_pile_cleared',
            nextPlayerId,
          })
        },
        onPlayerFinished: (playerId: number, playerName: string, finishPosition: number, rank: PlayerRank) => {
          broadcastToGame(newGameId, {
            type: 'president_player_finished',
            playerId,
            playerName,
            finishPosition,
            rank,
          })
        },
        onRoundComplete: (rankings: Array<{ playerId: number; rank: PlayerRank; name: string }>, roundNumber: number) => {
          broadcastToGame(newGameId, {
            type: 'president_round_complete',
            rankings,
            roundNumber,
          })
        },
        onGameOver: (finalRankings: Array<{ playerId: number; name: string; rank: PlayerRank }>) => {
          broadcastToGame(newGameId, {
            type: 'president_game_over',
            finalRankings,
          })
        },
        onCardExchangeInfo: (playerId: string, youGive: StandardCard[], youReceive: StandardCard[], otherPlayerName: string, yourRole: string) => {
          sendToPlayer(playerId, {
            type: 'president_card_exchange_info',
            youGive,
            youReceive,
            otherPlayerName,
            yourRole,
          })
        },
        onAwaitingGiveCards: (playerId: string, cardsToGive: number, receivedCards: StandardCard[], yourRole: string) => {
          sendToPlayer(playerId, {
            type: 'president_awaiting_give_cards',
            cardsToGive,
            receivedCards,
            yourRole,
          })
        },
        onYourTurn: (playerId: string, validActions: string[], validPlays: string[][]) => {
          sendToPlayer(playerId, {
            type: 'president_your_turn',
            validActions,
            validPlays,
          })
        },
        onTurnReminder: (playerId: string, validActions: string[], validPlays: string[][]) => {
          sendToPlayer(playerId, {
            type: 'president_your_turn',
            validActions,
            validPlays,
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
      }, humanPlayers.length || 4, false)

      newPresidentGame.initializePlayers(humanPlayers)
      presidentGames.set(newGameId, newPresidentGame)

      // Update all clients to the new game
      for (const [, c] of clients) {
        if (c.gameId === oldGameId) {
          c.gameId = newGameId
        }
      }

      // Clean up old game
      presidentGames.delete(oldGameId)
      gameHosts.delete(oldGameId)
      gameTypes.delete(oldGameId)
      gameSettings.delete(oldGameId)

      console.log(`President game restarted: ${oldGameId} -> ${newGameId}`)

      // Send game_started to all players
      broadcastToGame(newGameId, {
        type: 'game_started',
        gameId: newGameId,
      })

      // Start the new game
      newPresidentGame.start()
      return
    }

    // Create new Euchre game
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
    }, { aiDifficulty: previousSettings?.aiDifficulty })

    newGame.initializePlayers(humanPlayers)
    games.set(newGameId, newGame)

    // Update all clients to the new game
    for (const [, c] of clients) {
      if (c.gameId === oldGameId) {
        c.gameId = newGameId
      }
    }

    // Clean up old game
    games.delete(oldGameId)
    gameHosts.delete(oldGameId)
    gameTypes.delete(oldGameId)
    gameSettings.delete(oldGameId)

    console.log(`Euchre game restarted: ${oldGameId} -> ${newGameId}`)

    // Send game_started to all players
    broadcastToGame(newGameId, {
      type: 'game_started',
      gameId: newGameId,
    })

    // Start the new game
    newGame.start()
  }

  return {
    handleStartGame,
    handleRestartGame,
    handleRequestState,
  }
}