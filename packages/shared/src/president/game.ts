// President game logic

import { FullRank, Suit } from '../core/types.js'
import type { StandardCard } from '../core/types.js'
import { createStandardDeck, dealAllCards } from '../core/deck.js'
import {
  PresidentPhase,
  PlayerRank,
  type PresidentGameState,
  type PresidentPlayer,
  type PresidentPlay,
} from './types.js'
import {
  createEmptyPile,
  addPlayToPile,
  createPlay,
  isValidPlay,
  getLowestCards,
  getHighestCards,
} from './play.js'

/**
 * Create initial player
 */
export function createPresidentPlayer(
  id: number,
  name: string,
  isHuman: boolean
): PresidentPlayer {
  return {
    id,
    name,
    hand: [],
    isHuman,
    rank: null,
    finishOrder: null,
    cardsToGive: 0,
    cardsToReceive: 0,
  }
}

/**
 * Create a new President game
 */
export function createPresidentGame(
  playerNames: string[],
  humanPlayerIndex: number = 0
): PresidentGameState {
  const numPlayers = playerNames.length

  if (numPlayers < 4 || numPlayers > 8) {
    throw new Error('President requires 4-8 players')
  }

  const players: PresidentPlayer[] = playerNames.map((name, i) =>
    createPresidentPlayer(i, name, i === humanPlayerIndex)
  )

  return {
    gameType: 'president',
    players,
    phase: PresidentPhase.Setup,
    currentPile: createEmptyPile(),
    currentPlayer: 0,
    consecutivePasses: 0,
    finishedPlayers: [],
    roundNumber: 1,
    gameOver: false,
    lastPlayerId: null,
  }
}

/**
 * Deal cards to all players
 */
export function dealPresidentCards(state: PresidentGameState): PresidentGameState {
  const deck = createStandardDeck()
  const hands = dealAllCards(deck, state.players.length)

  const players = state.players.map((player, i) => ({
    ...player,
    hand: hands[i] ?? [],
    finishOrder: null,  // Reset for new round
  }))

  return {
    ...state,
    players,
    phase: PresidentPhase.Dealing,
    currentPile: createEmptyPile(),
    consecutivePasses: 0,
    finishedPlayers: [],
    lastPlayerId: null,
  }
}

/**
 * Get the number of active (non-finished) players
 */
export function getActivePlayers(state: PresidentGameState): PresidentPlayer[] {
  return state.players.filter(p => p.finishOrder === null)
}

/**
 * Get next active player after the given player
 */
export function getNextActivePlayer(
  state: PresidentGameState,
  currentPlayerId: number
): number {
  const numPlayers = state.players.length
  let nextId = (currentPlayerId + 1) % numPlayers

  // Find next player who hasn't finished
  while (state.players[nextId]!.finishOrder !== null) {
    nextId = (nextId + 1) % numPlayers
    // Safety check to avoid infinite loop
    if (nextId === currentPlayerId) {
      return currentPlayerId
    }
  }

  return nextId
}

/**
 * Process a play action
 */
export function processPlay(
  state: PresidentGameState,
  playerId: number,
  cards: StandardCard[]
): PresidentGameState {
  const player = state.players[playerId]
  if (!player || player.finishOrder !== null) {
    return state // Player already finished
  }

  // Validate play
  if (!isValidPlay(cards, state.currentPile)) {
    return state // Invalid play
  }

  const play = createPlay(cards, playerId)
  if (!play) {
    return state
  }

  // Remove cards from player's hand
  const cardIds = new Set(cards.map(c => c.id))
  const newHand = player.hand.filter(c => !cardIds.has(c.id))

  // Check if player is out
  const isPlayerOut = newHand.length === 0
  const newFinishOrder = isPlayerOut
    ? state.finishedPlayers.length + 1
    : null

  // Update players
  const players = state.players.map(p =>
    p.id === playerId
      ? { ...p, hand: newHand, finishOrder: newFinishOrder }
      : p
  )

  // Update finished players list
  const finishedPlayers = isPlayerOut
    ? [...state.finishedPlayers, playerId]
    : state.finishedPlayers

  // Check if round is complete (only 1 player left)
  const activePlayers = players.filter(p => p.finishOrder === null)
  const isRoundComplete = activePlayers.length <= 1

  if (isRoundComplete) {
    // Last player still in automatically gets last place
    const lastPlayer = activePlayers[0]
    if (lastPlayer) {
      const finalPlayers = players.map(p =>
        p.id === lastPlayer.id
          ? { ...p, finishOrder: finishedPlayers.length + 1 }
          : p
      )
      return {
        ...state,
        players: finalPlayers,
        currentPile: addPlayToPile(state.currentPile, play),
        finishedPlayers: [...finishedPlayers, lastPlayer.id],
        phase: PresidentPhase.RoundComplete,
        lastPlayerId: playerId,
      }
    }
  }

  // Get next player
  const nextPlayer = getNextActivePlayer(
    { ...state, players },
    playerId
  )

  return {
    ...state,
    players,
    currentPile: addPlayToPile(state.currentPile, play),
    currentPlayer: nextPlayer,
    consecutivePasses: 0,
    finishedPlayers,
    lastPlayerId: playerId,
  }
}

/**
 * Process a pass action
 */
export function processPass(
  state: PresidentGameState,
  playerId: number
): PresidentGameState {
  const player = state.players[playerId]
  if (!player || player.finishOrder !== null) {
    return state
  }

  const activePlayers = getActivePlayers(state)
  const newConsecutivePasses = state.consecutivePasses + 1

  // Check if everyone passed - pile clears, last player leads
  // (passes = active players - 1, since last player who played doesn't pass)
  if (newConsecutivePasses >= activePlayers.length - 1 && state.lastPlayerId !== null) {
    // Clear pile, last player to play leads
    return {
      ...state,
      currentPile: createEmptyPile(),
      currentPlayer: state.lastPlayerId,
      consecutivePasses: 0,
    }
  }

  // Normal pass - next player's turn
  const nextPlayer = getNextActivePlayer(state, playerId)

  return {
    ...state,
    currentPlayer: nextPlayer,
    consecutivePasses: newConsecutivePasses,
  }
}

/**
 * Assign player ranks based on finish order
 */
export function assignRanks(state: PresidentGameState): PresidentGameState {
  const numPlayers = state.players.length

  const players = state.players.map(player => {
    const finishOrder = player.finishOrder
    if (finishOrder === null) return player

    let rank: PlayerRank
    let cardsToGive = 0
    let cardsToReceive = 0

    if (finishOrder === 1) {
      rank = PlayerRank.President
      cardsToReceive = 2
    } else if (finishOrder === 2 && numPlayers >= 5) {
      rank = PlayerRank.VicePresident
      cardsToReceive = 1
    } else if (finishOrder === numPlayers) {
      rank = PlayerRank.Scum
      cardsToGive = 2
    } else if (finishOrder === numPlayers - 1 && numPlayers >= 5) {
      rank = PlayerRank.Citizen  // Actually Vice-Scum
      cardsToGive = 1
    } else {
      rank = PlayerRank.Citizen
    }

    return {
      ...player,
      rank,
      cardsToGive,
      cardsToReceive,
    }
  })

  return {
    ...state,
    players,
  }
}

/**
 * Start a new round
 */
export function startNewRound(state: PresidentGameState): PresidentGameState {
  // Deal new cards
  const dealtState = dealPresidentCards(state)

  // Check if this is first round (no ranks) or subsequent (card exchange)
  const hasRanks = state.players.some(p => p.rank !== null)

  if (hasRanks) {
    return {
      ...dealtState,
      phase: PresidentPhase.CardExchange,
      roundNumber: state.roundNumber + 1,
    }
  }

  // First round - find player with 3 of clubs to start
  const startingPlayer = findStartingPlayer(dealtState)

  return {
    ...dealtState,
    phase: PresidentPhase.Playing,
    currentPlayer: startingPlayer,
    roundNumber: state.roundNumber,
  }
}

/**
 * Find player with 3 of clubs (starts first round)
 */
export function findStartingPlayer(state: PresidentGameState): number {
  for (const player of state.players) {
    const has3Clubs = player.hand.some(
      card => card.rank === FullRank.Three && card.suit === Suit.Clubs
    )
    if (has3Clubs) {
      return player.id
    }
  }
  // Fallback to player 0
  return 0
}

/**
 * Process card exchange between President/Scum
 */
export function processCardExchange(
  state: PresidentGameState,
  fromPlayerId: number,
  cards: StandardCard[]
): PresidentGameState {
  const fromPlayer = state.players[fromPlayerId]
  if (!fromPlayer) return state

  // Find recipient based on ranks
  let toPlayerId: number | null = null

  if (fromPlayer.rank === PlayerRank.Scum) {
    // Scum gives to President
    toPlayerId = state.players.find(p => p.rank === PlayerRank.President)?.id ?? null
  } else if (fromPlayer.rank === PlayerRank.Citizen && fromPlayer.cardsToGive > 0) {
    // Vice-Scum gives to Vice President
    toPlayerId = state.players.find(p => p.rank === PlayerRank.VicePresident)?.id ?? null
  }

  if (toPlayerId === null) return state

  const toPlayer = state.players[toPlayerId]
  if (!toPlayer) return state

  // Transfer cards
  const cardIds = new Set(cards.map(c => c.id))
  const fromHand = fromPlayer.hand.filter(c => !cardIds.has(c.id))
  const toHand = [...toPlayer.hand, ...cards]

  const players = state.players.map(p => {
    if (p.id === fromPlayerId) {
      return { ...p, hand: fromHand, cardsToGive: p.cardsToGive - cards.length }
    }
    if (p.id === toPlayerId) {
      return { ...p, hand: toHand }
    }
    return p
  })

  // Check if all exchanges are complete
  const allExchangesDone = players.every(p => p.cardsToGive === 0)

  if (allExchangesDone) {
    // Now higher ranks give back their worst cards
    // For simplicity, auto-complete this step
    const finalPlayers = completeReverseExchange(players)

    // President starts (or whoever has lowest card if President finished)
    const president = finalPlayers.find(p => p.rank === PlayerRank.President)
    const startPlayer = president?.id ?? 0

    return {
      ...state,
      players: finalPlayers,
      phase: PresidentPhase.Playing,
      currentPlayer: startPlayer,
    }
  }

  return {
    ...state,
    players,
  }
}

/**
 * President/VP give their worst cards to Scum/Vice-Scum
 */
function completeReverseExchange(players: PresidentPlayer[]): PresidentPlayer[] {
  // Find players who need to give and receive
  const president = players.find(p => p.rank === PlayerRank.President)
  const vp = players.find(p => p.rank === PlayerRank.VicePresident)
  const scum = players.find(p => p.rank === PlayerRank.Scum)
  const viceScum = players.find(p => p.cardsToGive === 1 && p.rank === PlayerRank.Citizen)

  let result = [...players]

  // President gives 2 lowest to Scum
  if (president && scum) {
    const cardsToGive = getLowestCards(president.hand, 2)
    const cardIds = new Set(cardsToGive.map(c => c.id))

    result = result.map(p => {
      if (p.id === president.id) {
        return { ...p, hand: p.hand.filter(c => !cardIds.has(c.id)) }
      }
      if (p.id === scum.id) {
        return { ...p, hand: [...p.hand, ...cardsToGive] }
      }
      return p
    })
  }

  // VP gives 1 lowest to Vice-Scum
  if (vp && viceScum) {
    const cardsToGive = getLowestCards(vp.hand, 1)
    const cardIds = new Set(cardsToGive.map(c => c.id))

    result = result.map(p => {
      if (p.id === vp.id) {
        return { ...p, hand: p.hand.filter(c => !cardIds.has(c.id)) }
      }
      if (p.id === viceScum.id) {
        return { ...p, hand: [...p.hand, ...cardsToGive] }
      }
      return p
    })
  }

  return result
}

/**
 * Check if game should end (e.g., after X rounds)
 */
export function checkGameOver(
  state: PresidentGameState,
  maxRounds: number = 5
): PresidentGameState {
  if (state.roundNumber >= maxRounds) {
    return {
      ...state,
      gameOver: true,
      phase: PresidentPhase.GameOver,
    }
  }
  return state
}
