import type { WebSocket } from 'ws'
import type {
  Bid,
  Card,
  ClientGameState,
  TeamScore,
  PresidentClientGameState,
  SpadesClientGameState,
  SpadesBid,
  SpadesTeamScore,
  StandardCard as SpadesStandardCard,
  StandardCard,
  PlayerRank,
  PlayType,
  Table,
  ServerMessage,
} from '@euchre/shared'
import { Game } from '../Game.js'
import { PresidentGame } from '../PresidentGame.js'
import { SpadesGame } from '../SpadesGame.js'
import type { ConnectedClient } from '../ws/types.js'
import {
  games,
  presidentGames,
  spadesGames,
  getRuntime,
  registerRuntime,
  unregisterRuntime,
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

  function logSessionEvent(event: string, details: Record<string, unknown>): void {
    console.info('[MP][session]', {
      ts: Date.now(),
      event,
      ...details,
    })
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
    const gameType = table.gameType || 'euchre'

    logSessionEvent('start_game_requested', {
      tableId,
      gameId,
      gameType,
      hostId: client.player.odusId,
      hostName: client.player.nickname,
      seatCount: table.seats.length,
    })

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

    // Track runtime + metadata

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
      registerRuntime(gameId, {
        type: gameType,
        runtime: presidentGame,
        hostId: table.hostId,
        settings: table.settings,
      })

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
      logSessionEvent('start_game_completed', {
        gameId,
        tableId,
        gameType,
        playerCount: humanPlayers.length,
      })
      return
    }

    if (gameType === 'spades') {
      const spadesGame = new SpadesGame(gameId, {
        onStateChange: (playerId: string | null, state: SpadesClientGameState) => {
          if (playerId) {
            sendToPlayer(playerId, { type: 'spades_game_state', state })
          }
        },
        onBidMade: (_playerId: number, _bid: SpadesBid, _playerName: string) => {
          // Spades UI is fully state-driven; no-op event for now.
        },
        onCardPlayed: (_playerId: number, _card: SpadesStandardCard, _playerName: string) => {
          // Spades UI is fully state-driven; no-op event for now.
        },
        onTrickComplete: (_winnerId: number, _winnerName: string, _cards: Array<{ playerId: number; card: SpadesStandardCard }>) => {
          // Spades UI is fully state-driven; no-op event for now.
        },
        onRoundComplete: (_scores: SpadesTeamScore[], _teamTricks: [number, number]) => {
          // Spades UI is fully state-driven; no-op event for now.
        },
        onGameOver: (_winningTeam: number, _finalScores: SpadesTeamScore[]) => {
          // Spades UI is fully state-driven; no-op event for now.
        },
        onYourTurn: (playerId: string, validActions: string[], validCards?: string[]) => {
          sendToPlayer(playerId, {
            type: 'spades_your_turn',
            validActions,
            validCards,
          })
        },
        onTurnReminder: (playerId: string, validActions: string[], validCards?: string[]) => {
          sendToPlayer(playerId, {
            type: 'spades_your_turn',
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

      spadesGame.initializePlayers(humanPlayers)
      spadesGames.set(gameId, spadesGame)
      registerRuntime(gameId, {
        type: gameType,
        runtime: spadesGame,
        hostId: table.hostId,
        settings: table.settings,
      })

      for (const [, c] of clients) {
        if (c.tableId === tableId) {
          c.gameId = gameId
          c.tableId = null
        }
      }

      console.log(`Starting Spades game ${gameId} at table ${table.name}`)

      broadcastToGame(gameId, {
        type: 'game_started',
        gameId,
      })

      tables.delete(tableId)
      broadcast({ type: 'table_removed', tableId })

      spadesGame.start()
      logSessionEvent('start_game_completed', {
        gameId,
        tableId,
        gameType,
        playerCount: humanPlayers.length,
      })
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
    registerRuntime(gameId, {
      type: gameType,
      runtime: game,
      hostId: table.hostId,
      settings: table.settings,
    })

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
    logSessionEvent('start_game_completed', {
      gameId,
      tableId,
      gameType,
      playerCount: humanPlayers.length,
    })
  }

  function handleRequestState(ws: WebSocket, client: ConnectedClient): void {
    if (!client.player || !client.gameId) {
      // Unrecoverable - tell client to bail
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
    logSessionEvent('request_state_received', {
      gameId: client.gameId,
      gameType: gameType ?? 'euchre',
      playerId: client.player.odusId,
      playerName: client.player.nickname,
    })

    runtimeEntry.runtime.resendStateToPlayer(client.player.odusId)

    console.log(`Resent state to ${client.player.nickname} (requested resync)`) 
    logSessionEvent('request_state_completed', {
      gameId: client.gameId,
      gameType: gameType ?? 'euchre',
      playerId: client.player.odusId,
    })
  }

  function handleRestartGame(ws: WebSocket, client: ConnectedClient): void {
    if (!client.player || !client.gameId) {
      send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
      return
    }

    const oldGameId = client.gameId
    const runtimeEntry = getRuntime(oldGameId)
    if (!runtimeEntry) {
      send(ws, { type: 'error', message: 'Game not found', code: 'game_lost' })
      client.gameId = null
      return
    }

    const hostId = runtimeEntry.hostId
    const gameType = runtimeEntry.type
    const previousSettings = runtimeEntry.settings

    logSessionEvent('restart_game_requested', {
      oldGameId,
      gameType,
      requesterId: client.player.odusId,
      requesterName: client.player.nickname,
    })

    // Only host can restart
    if (client.player.odusId !== hostId) {
      send(ws, { type: 'error', message: 'Only host can restart game' })
      return
    }

    // Get old runtime to find player info
    const oldRuntime = runtimeEntry?.runtime
    const oldEuchreGame = oldRuntime ? null : games.get(oldGameId)
    const oldPresidentGame = oldRuntime ? null : presidentGames.get(oldGameId)
    const oldSpadesGame = oldRuntime ? null : spadesGames.get(oldGameId)

    if (!oldRuntime && !oldEuchreGame && !oldPresidentGame && !oldSpadesGame) {
      send(ws, { type: 'error', message: 'Game not found' })
      return
    }

    // Collect all human players currently in the game
    const humanPlayers: Array<{ odusId: string; name: string; seatIndex: number }> = []
    for (const [, c] of clients) {
      if (c.gameId === oldGameId && c.player) {
        // Find their seat index from the old game
        const playerInfo = oldRuntime?.getPlayerInfo(c.player.odusId) ||
               oldEuchreGame?.getPlayerInfo(c.player.odusId) ||
                           oldPresidentGame?.getPlayerInfo(c.player.odusId) ||
                           oldSpadesGame?.getPlayerInfo(c.player.odusId)
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
      registerRuntime(newGameId, {
        type: gameType,
        runtime: newPresidentGame,
        hostId,
        settings: previousSettings,
      })

      // Update all clients to the new game
      for (const [, c] of clients) {
        if (c.gameId === oldGameId) {
          c.gameId = newGameId
        }
      }

      // Clean up old game
      presidentGames.delete(oldGameId)
      unregisterRuntime(oldGameId)

      console.log(`President game restarted: ${oldGameId} -> ${newGameId}`)

      // Send game_started to all players
      broadcastToGame(newGameId, {
        type: 'game_started',
        gameId: newGameId,
      })

      // Start the new game
      newPresidentGame.start()
      logSessionEvent('restart_game_completed', {
        oldGameId,
        newGameId,
        gameType,
        playerCount: humanPlayers.length,
      })
      return
    }

    if (gameType === 'spades') {
      const newSpadesGame = new SpadesGame(newGameId, {
        onStateChange: (playerId: string | null, state: SpadesClientGameState) => {
          if (playerId) {
            sendToPlayer(playerId, { type: 'spades_game_state', state })
          }
        },
        onBidMade: (_playerId: number, _bid: SpadesBid, _playerName: string) => {},
        onCardPlayed: (_playerId: number, _card: SpadesStandardCard, _playerName: string) => {},
        onTrickComplete: (_winnerId: number, _winnerName: string, _cards: Array<{ playerId: number; card: SpadesStandardCard }>) => {},
        onRoundComplete: (_scores: SpadesTeamScore[], _teamTricks: [number, number]) => {},
        onGameOver: (_winningTeam: number, _finalScores: SpadesTeamScore[]) => {},
        onYourTurn: (playerId: string, validActions: string[], validCards?: string[]) => {
          sendToPlayer(playerId, {
            type: 'spades_your_turn',
            validActions,
            validCards,
          })
        },
        onTurnReminder: (playerId: string, validActions: string[], validCards?: string[]) => {
          sendToPlayer(playerId, {
            type: 'spades_your_turn',
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

      newSpadesGame.initializePlayers(humanPlayers)
      spadesGames.set(newGameId, newSpadesGame)
      registerRuntime(newGameId, {
        type: gameType,
        runtime: newSpadesGame,
        hostId,
        settings: previousSettings,
      })

      for (const [, c] of clients) {
        if (c.gameId === oldGameId) {
          c.gameId = newGameId
        }
      }

      spadesGames.delete(oldGameId)
      unregisterRuntime(oldGameId)

      console.log(`Spades game restarted: ${oldGameId} -> ${newGameId}`)

      broadcastToGame(newGameId, {
        type: 'game_started',
        gameId: newGameId,
      })

      newSpadesGame.start()
      logSessionEvent('restart_game_completed', {
        oldGameId,
        newGameId,
        gameType,
        playerCount: humanPlayers.length,
      })
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
    registerRuntime(newGameId, {
      type: gameType,
      runtime: newGame,
      hostId,
      settings: previousSettings,
    })

    // Update all clients to the new game
    for (const [, c] of clients) {
      if (c.gameId === oldGameId) {
        c.gameId = newGameId
      }
    }

    // Clean up old game
    games.delete(oldGameId)
    unregisterRuntime(oldGameId)

    console.log(`Euchre game restarted: ${oldGameId} -> ${newGameId}`)

    // Send game_started to all players
    broadcastToGame(newGameId, {
      type: 'game_started',
      gameId: newGameId,
    })

    // Start the new game
    newGame.start()
    logSessionEvent('restart_game_completed', {
      oldGameId,
      newGameId,
      gameType,
      playerCount: humanPlayers.length,
    })
  }

  return {
    handleStartGame,
    handleRestartGame,
    handleRequestState,
  }
}