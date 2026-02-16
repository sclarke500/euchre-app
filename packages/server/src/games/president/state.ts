import type {
  PresidentClientGameState,
  PresidentClientPlayer,
  PresidentGameState,
  PresidentPhase,
  PresidentPile,
} from '@67cards/shared'
import type { PresidentGamePlayer } from './types.js'

interface BuildPresidentClientStateParams {
  odusId: string | null
  players: PresidentGamePlayer[]
  phase: PresidentPhase
  currentPile: PresidentPile
  currentPlayer: number
  consecutivePasses: number
  finishedPlayers: number[]
  roundNumber: number
  gameOver: boolean
  lastPlayerId: number | null
  superTwosMode: boolean
  stateSeq: number
  timedOutPlayer: number | null
}

export function buildPresidentClientState({
  odusId,
  players,
  phase,
  currentPile,
  currentPlayer,
  consecutivePasses,
  finishedPlayers,
  roundNumber,
  gameOver,
  lastPlayerId,
  superTwosMode,
  stateSeq,
  timedOutPlayer,
}: BuildPresidentClientStateParams): PresidentClientGameState {
  const playerIndex = odusId ? players.findIndex((p) => p.odusId === odusId) : -1

  const clientPlayers: PresidentClientPlayer[] = players.map((p, index) => ({
    id: index,
    name: p.name,
    handSize: p.hand.length,
    hand: index === playerIndex ? p.hand : undefined,
    isHuman: p.isHuman,
    rank: p.rank,
    finishOrder: p.finishOrder,
    cardsToGive: p.cardsToGive,
    cardsToReceive: p.cardsToReceive,
  }))

  return {
    gameType: 'president',
    phase,
    players: clientPlayers,
    currentPlayer,
    currentPile,
    consecutivePasses,
    finishedPlayers,
    roundNumber,
    gameOver,
    lastPlayerId,
    superTwosMode,
    stateSeq,
    timedOutPlayer,
  }
}

interface BuildPresidentGameStateParams {
  players: PresidentGamePlayer[]
  phase: PresidentPhase
  currentPile: PresidentPile
  currentPlayer: number
  consecutivePasses: number
  finishedPlayers: number[]
  roundNumber: number
  gameOver: boolean
  lastPlayerId: number | null
  superTwosMode: boolean
  awaitingGiveCards: number | null
}

export function buildPresidentGameState({
  players,
  phase,
  currentPile,
  currentPlayer,
  consecutivePasses,
  finishedPlayers,
  roundNumber,
  gameOver,
  lastPlayerId,
  superTwosMode,
  awaitingGiveCards,
}: BuildPresidentGameStateParams): PresidentGameState {
  return {
    gameType: 'president',
    players: players.map((p) => ({
      id: p.seatIndex,
      name: p.name,
      hand: p.hand,
      isHuman: p.isHuman,
      rank: p.rank,
      finishOrder: p.finishOrder,
      cardsToGive: p.cardsToGive,
      cardsToReceive: p.cardsToReceive,
    })),
    phase,
    currentPile,
    currentPlayer,
    consecutivePasses,
    finishedPlayers,
    roundNumber,
    gameOver,
    lastPlayerId,
    rules: {
      superTwosMode,
      whoLeads: 'scum',
      playStyle: 'multiLoop',
    },
    pendingExchanges: [],
    awaitingGiveBack: awaitingGiveCards,
  }
}

export function applyPresidentGameState(
  players: PresidentGamePlayer[],
  state: PresidentGameState
): {
  phase: PresidentPhase
  currentPile: PresidentPile
  currentPlayer: number
  consecutivePasses: number
  finishedPlayers: number[]
  gameOver: boolean
  lastPlayerId: number | null
} {
  for (let i = 0; i < players.length && i < state.players.length; i++) {
    const statePlayer = state.players[i]!
    const localPlayer = players[i]!
    localPlayer.hand = statePlayer.hand
    localPlayer.rank = statePlayer.rank
    localPlayer.finishOrder = statePlayer.finishOrder
    localPlayer.cardsToGive = statePlayer.cardsToGive
    localPlayer.cardsToReceive = statePlayer.cardsToReceive
  }

  return {
    phase: state.phase,
    currentPile: state.currentPile,
    currentPlayer: state.currentPlayer,
    consecutivePasses: state.consecutivePasses,
    finishedPlayers: state.finishedPlayers,
    gameOver: state.gameOver,
    lastPlayerId: state.lastPlayerId,
  }
}
