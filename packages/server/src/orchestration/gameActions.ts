import { WebSocket } from 'ws'
import type { Bid, SpadesBidType } from '@67cards/shared'
import type { ConnectedClient } from '../ws/types.js'
import { games, getRuntime, presidentGames, spadesGames } from '../sessions/registry.js'

interface ActionDeps {
  send: (ws: WebSocket, message: { type: 'error'; message: string; code?: string }) => void
  tryRecoverGameId: (client: ConnectedClient) => boolean
  replacePlayerWithAI: (client: ConnectedClient, trackForReconnect?: boolean) => void
}

export interface GameActionHandlers {
  handleSpadesMakeBid: (
    ws: WebSocket,
    client: ConnectedClient,
    bidType: 'normal' | 'nil' | 'blind_nil',
    count: number
  ) => void
  handleMakeBid: (
    ws: WebSocket,
    client: ConnectedClient,
    action: Bid['action'],
    suit?: Bid['suit'],
    goingAlone?: boolean
  ) => void
  handlePlayCard: (ws: WebSocket, client: ConnectedClient, cardId: string) => void
  handleDiscardCard: (ws: WebSocket, client: ConnectedClient, cardId: string) => void
  handleBootPlayer: (ws: WebSocket, client: ConnectedClient, playerId: number) => void
  handlePresidentPlayCards: (ws: WebSocket, client: ConnectedClient, cardIds: string[]) => void
  handlePresidentPass: (ws: WebSocket, client: ConnectedClient) => void
  handlePresidentGiveCards: (ws: WebSocket, client: ConnectedClient, cardIds: string[]) => void
  handleLeaveGame: (ws: WebSocket, client: ConnectedClient) => void
}

export function createGameActionHandlers({
  send,
  tryRecoverGameId,
  replacePlayerWithAI,
}: ActionDeps): GameActionHandlers {
  function requireActivePlayerAndGame(ws: WebSocket, client: ConnectedClient): string | null {
    if (!client.player) {
      send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
      return null
    }

    if (!client.gameId) {
      tryRecoverGameId(client)
    }

    if (!client.gameId) {
      send(ws, { type: 'error', message: 'Not in a game', code: 'game_lost' })
      return null
    }

    return client.gameId
  }

  function handleSpadesMakeBid(
    ws: WebSocket,
    client: ConnectedClient,
    bidType: 'normal' | 'nil' | 'blind_nil',
    count: number
  ): void {
    const gameId = requireActivePlayerAndGame(ws, client)
    if (!gameId || !client.player) {
      return
    }

    const spadesGame = spadesGames.get(gameId)
    if (!spadesGame) {
      send(ws, { type: 'error', message: 'Spades game not found' })
      return
    }

    const success = spadesGame.handleBid(client.player.odusId, {
      type: bidType as SpadesBidType,
      count,
    })
    if (!success) {
      send(ws, { type: 'error', message: 'Invalid Spades bid' })
    }
  }

  function handleMakeBid(
    ws: WebSocket,
    client: ConnectedClient,
    action: Bid['action'],
    suit?: Bid['suit'],
    goingAlone?: boolean
  ): void {
    const gameId = requireActivePlayerAndGame(ws, client)
    if (!gameId || !client.player) {
      return
    }

    const game = games.get(gameId)
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
    const gameId = requireActivePlayerAndGame(ws, client)
    if (!gameId || !client.player) {
      return
    }

    const runtimeEntry = getRuntime(gameId)
    if (!runtimeEntry) {
      send(ws, { type: 'error', message: 'Game not found', code: 'game_lost' })
      client.gameId = null
      return
    }

    let success = false

    if (runtimeEntry.type === 'spades') {
      const spadesGame = spadesGames.get(gameId)
      if (!spadesGame) {
        send(ws, { type: 'error', message: 'Game not found' })
        return
      }

      success = spadesGame.handlePlayCard(client.player.odusId, cardId)
    } else {
      const game = games.get(gameId)
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
    const gameId = requireActivePlayerAndGame(ws, client)
    if (!gameId || !client.player) {
      return
    }

    const game = games.get(gameId)
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
    const gameId = requireActivePlayerAndGame(ws, client)
    if (!gameId) {
      return
    }

    const runtimeEntry = getRuntime(gameId)
    if (!runtimeEntry) {
      send(ws, { type: 'error', message: 'Game not found', code: 'game_lost' })
      client.gameId = null
      return
    }

    let success = false

    if (runtimeEntry.type === 'president') {
      const presidentGame = presidentGames.get(gameId)
      if (!presidentGame) {
        send(ws, { type: 'error', message: 'Game not found' })
        return
      }
      success = presidentGame.bootPlayer(playerId)
    } else if (runtimeEntry.type === 'spades') {
      const spadesGame = spadesGames.get(gameId)
      if (!spadesGame) {
        send(ws, { type: 'error', message: 'Game not found' })
        return
      }
      success = spadesGame.bootPlayer(playerId)
    } else {
      const game = games.get(gameId)
      if (!game) {
        send(ws, { type: 'error', message: 'Game not found' })
        return
      }
      success = game.bootPlayer(playerId)
    }

    if (!success) {
      console.log(
        `Boot request for player ${playerId} ignored (not timed out or already booted)`
      )
    }
  }

  function handlePresidentPlayCards(
    ws: WebSocket,
    client: ConnectedClient,
    cardIds: string[]
  ): void {
    const gameId = requireActivePlayerAndGame(ws, client)
    if (!gameId || !client.player) {
      return
    }

    const presidentGame = presidentGames.get(gameId)
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
    const gameId = requireActivePlayerAndGame(ws, client)
    if (!gameId || !client.player) {
      return
    }

    const presidentGame = presidentGames.get(gameId)
    if (!presidentGame) {
      send(ws, { type: 'error', message: 'President game not found' })
      return
    }

    const success = presidentGame.handlePass(client.player.odusId)
    if (!success) {
      send(ws, { type: 'error', message: 'Cannot pass right now' })
    }
  }

  function handlePresidentGiveCards(
    ws: WebSocket,
    client: ConnectedClient,
    cardIds: string[]
  ): void {
    const gameId = requireActivePlayerAndGame(ws, client)
    if (!gameId || !client.player) {
      return
    }

    const presidentGame = presidentGames.get(gameId)
    if (!presidentGame) {
      send(ws, { type: 'error', message: 'President game not found' })
      return
    }

    const success = presidentGame.handleGiveCards(client.player.odusId, cardIds)
    if (!success) {
      send(ws, { type: 'error', message: 'Invalid card selection' })
    }
  }

  function handleLeaveGame(_ws: WebSocket, client: ConnectedClient): void {
    replacePlayerWithAI(client, false)
  }

  return {
    handleSpadesMakeBid,
    handleMakeBid,
    handlePlayCard,
    handleDiscardCard,
    handleBootPlayer,
    handlePresidentPlayCards,
    handlePresidentPass,
    handlePresidentGiveCards,
    handleLeaveGame,
  }
}
