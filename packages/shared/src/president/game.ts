// President game logic

import { FullRank, Suit } from '../core/types.js'
import type { StandardCard } from '../core/types.js'
import { createStandardDeck, createPresidentDeck, dealAllCards } from '../core/deck.js'
import {
  PresidentPhase,
  PlayerRank,
  type PresidentGameState,
  type PresidentPlayer,
  type PresidentPlay,
  type PresidentRules,
  type PendingExchange,
} from './types.js'

/**
 * Default rules
 */
export const DEFAULT_PRESIDENT_RULES: PresidentRules = {
  superTwosMode: false,
  whoLeads: 'scum',
  turnStyle: 'original',
}
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
  humanPlayerIndex: number = 0,
  rules: Partial<PresidentRules> = {}
): PresidentGameState {
  const numPlayers = playerNames.length

  if (numPlayers < 4 || numPlayers > 8) {
    throw new Error('President requires 4-8 players')
  }

  const players: PresidentPlayer[] = playerNames.map((name, i) =>
    createPresidentPlayer(i, name, i === humanPlayerIndex)
  )

  const fullRules: PresidentRules = {
    ...DEFAULT_PRESIDENT_RULES,
    ...rules,
  }

  return {
    gameType: 'president',
    players,
    phase: PresidentPhase.Setup,
    currentPile: createEmptyPile(),
    currentPlayer: 0,
    consecutivePasses: 0,
    passedThisTrick: [],
    finishedPlayers: [],
    roundNumber: 1,
    gameOver: false,
    lastPlayerId: null,
    rules: fullRules,
    pendingExchanges: [],
    awaitingGiveBack: null,
  }
}

/**
 * Deal cards to all players
 */
export function dealPresidentCards(state: PresidentGameState): PresidentGameState {
  // Use deck with jokers if super 2s mode is enabled
  const deck = state.rules.superTwosMode
    ? createPresidentDeck(true)
    : createStandardDeck()
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
    passedThisTrick: [],
    finishedPlayers: [],
    lastPlayerId: null,
    pendingExchanges: [],
    awaitingGiveBack: null,
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
 * In passLockout mode, also skips players who've passed this trick
 */
export function getNextActivePlayer(
  state: PresidentGameState,
  currentPlayerId: number
): number {
  const numPlayers = state.players.length
  const turnStyle = state.rules.turnStyle || 'original'
  const passedThisTrick = state.passedThisTrick || []
  
  let nextId = (currentPlayerId + 1) % numPlayers
  let iterations = 0

  // Find next player who:
  // 1. Hasn't finished the round
  // 2. Hasn't passed this trick (in passLockout mode)
  while (iterations < numPlayers) {
    const player = state.players[nextId]!
    const hasFinished = player.finishOrder !== null
    const hasPassedThisTrick = turnStyle === 'passLockout' && passedThisTrick.includes(nextId)
    
    if (!hasFinished && !hasPassedThisTrick) {
      return nextId
    }
    
    nextId = (nextId + 1) % numPlayers
    iterations++
  }

  // Fallback: return current player (shouldn't happen)
  return currentPlayerId
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
  if (!isValidPlay(cards, state.currentPile, state.rules.superTwosMode)) {
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
  const turnStyle = state.rules.turnStyle || 'original'
  const newConsecutivePasses = state.consecutivePasses + 1

  // For passLockout mode: track who has passed this trick
  const newPassedThisTrick = turnStyle === 'passLockout' && !state.passedThisTrick.includes(playerId)
    ? [...state.passedThisTrick, playerId]
    : state.passedThisTrick

  // Calculate how many players can still play in this trick
  const playersStillInTrick = turnStyle === 'passLockout'
    ? activePlayers.filter(p => !newPassedThisTrick.includes(p.id))
    : activePlayers

  // Check if trick should end (pile clears)
  const shouldClearPile = (
    // Original mode: everyone passed consecutively
    (turnStyle === 'original' && newConsecutivePasses >= activePlayers.length - 1 && state.lastPlayerId !== null) ||
    // Pass lockout mode: everyone still in trick has passed (only last player remains)
    (turnStyle === 'passLockout' && playersStillInTrick.length <= 1 && state.lastPlayerId !== null) ||
    // Single round mode: gone around once
    (turnStyle === 'singleRound' && newConsecutivePasses >= activePlayers.length - 1 && state.lastPlayerId !== null)
  )

  if (shouldClearPile) {
    // If last player finished, find next active player after them
    const lastPlayer = state.players[state.lastPlayerId!]
    const newLeader = lastPlayer?.finishOrder !== null
      ? getNextActivePlayer(state, state.lastPlayerId!)
      : state.lastPlayerId!
    return {
      ...state,
      currentPile: createEmptyPile(),
      currentPlayer: newLeader,
      consecutivePasses: 0,
      passedThisTrick: [],  // Reset for new trick
    }
  }

  // Normal pass - next player's turn
  // In passLockout mode, getNextActivePlayer will skip players who've passed
  const nextPlayer = getNextActivePlayer(
    { ...state, passedThisTrick: newPassedThisTrick },
    playerId
  )

  return {
    ...state,
    currentPlayer: nextPlayer,
    consecutivePasses: newConsecutivePasses,
    passedThisTrick: newPassedThisTrick,
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
      rank = PlayerRank.ViceScum
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
  // Deal new cards (equal hands for all players)
  const dealtState = dealPresidentCards(state)

  // Check if this is first round (no ranks) or subsequent (card exchange)
  const hasRanks = state.players.some(p => p.rank !== null)

  if (hasRanks) {
    // Start card exchange phase - all players confirm simultaneously
    return {
      ...dealtState,
      phase: PresidentPhase.CardExchange,
      roundNumber: state.roundNumber + 1,
      awaitingGiveBack: null,
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
 * Process President/VP giving cards to Scum/Vice-Scum (bidirectional exchange).
 * When President gives selected cards to Scum, Scum simultaneously gives their
 * highest cards to President. Called during CardExchange phase (SP only).
 */
export function processGiveBackCards(
  state: PresidentGameState,
  fromPlayerId: number,
  cards: StandardCard[]
): PresidentGameState {
  if (state.phase !== PresidentPhase.CardExchange) return state
  if (state.awaitingGiveBack !== fromPlayerId) return state

  const fromPlayer = state.players[fromPlayerId]
  if (!fromPlayer) return state

  // Determine exchange partner based on who's giving
  let toPlayerId: number | null = null
  let expectedCardCount = 0

  if (fromPlayer.rank === PlayerRank.President) {
    toPlayerId = state.players.find(p => p.rank === PlayerRank.Scum)?.id ?? null
    expectedCardCount = 2
  } else if (fromPlayer.rank === PlayerRank.VicePresident) {
    // Find Vice-Scum
    toPlayerId = state.players.find(p => p.rank === PlayerRank.ViceScum)?.id ?? null
    expectedCardCount = 1
  }

  if (toPlayerId === null) return state
  if (cards.length !== expectedCardCount) return state

  const toPlayer = state.players[toPlayerId]
  if (!toPlayer) return state

  // Bidirectional exchange:
  // 1. Scum/ViceScum gives highest cards to President/VP
  const scumGiveCards = getHighestCards(toPlayer.hand, expectedCardCount)
  const scumGiveIds = new Set(scumGiveCards.map(c => c.id))

  // 2. President/VP gives selected cards to Scum/ViceScum
  const presGiveIds = new Set(cards.map(c => c.id))

  const pendingExchanges: PendingExchange[] = [
    ...state.pendingExchanges,
    { fromPlayerId: toPlayerId, toPlayerId: fromPlayerId, cards: scumGiveCards, complete: true },
    { fromPlayerId: fromPlayerId, toPlayerId: toPlayerId, cards: [...cards], complete: true },
  ]

  const players = state.players.map(p => {
    if (p.id === fromPlayerId) {
      // President/VP: remove given cards, add received from scum
      return {
        ...p,
        hand: [...p.hand.filter(c => !presGiveIds.has(c.id)), ...scumGiveCards],
      }
    }
    if (p.id === toPlayerId) {
      // Scum/ViceScum: remove highest cards, add president's given cards
      return {
        ...p,
        hand: [...p.hand.filter(c => !scumGiveIds.has(c.id)), ...cards],
      }
    }
    return p
  })

  // Check if VP also needs to give (5+ players)
  const vp = players.find(p => p.rank === PlayerRank.VicePresident)
  const vpNeedsToGive = vp && fromPlayer.rank === PlayerRank.President && players.length >= 5

  if (vpNeedsToGive && vp) {
    // VP's turn to give
    return {
      ...state,
      players,
      pendingExchanges,
      awaitingGiveBack: vp.id,
    }
  }

  // All exchanges complete - determine who leads
  const startPlayer = getLeadingPlayer(state, players)

  return {
    ...state,
    players,
    pendingExchanges,
    phase: PresidentPhase.Playing,
    currentPlayer: startPlayer,
    awaitingGiveBack: null,
  }
}

/**
 * Determine who leads based on rules
 */
function getLeadingPlayer(state: PresidentGameState, players: PresidentPlayer[]): number {
  if (state.rules.whoLeads === 'scum') {
    const scum = players.find(p => p.rank === PlayerRank.Scum)
    return scum?.id ?? 0
  }
  
  // Default: President leads
  const president = players.find(p => p.rank === PlayerRank.President)
  return president?.id ?? 0
}

/**
 * Extract human-relevant exchange info from pendingExchanges.
 * Called after processGiveBackCards completes to build the notification data.
 */
export function getHumanExchangeInfo(
  pendingExchanges: PendingExchange[],
  humanPlayerId: number,
  players: PresidentPlayer[]
): {
  youGive: StandardCard[]
  youReceive: StandardCard[]
  otherPlayerName: string
  yourRole: string
} | null {
  // Find exchanges involving the human
  const humanGave = pendingExchanges.find(e => e.fromPlayerId === humanPlayerId)
  const humanReceived = pendingExchanges.find(e => e.toPlayerId === humanPlayerId)

  if (!humanGave && !humanReceived) return null

  const human = players.find(p => p.id === humanPlayerId)
  const otherPlayerId = humanGave?.toPlayerId ?? humanReceived?.fromPlayerId
  const other = otherPlayerId !== undefined ? players.find(p => p.id === otherPlayerId) : undefined

  const roleNames: Record<PlayerRank, string> = {
    [PlayerRank.President]: 'President',
    [PlayerRank.VicePresident]: 'Vice President',
    [PlayerRank.Citizen]: 'Citizen',
    [PlayerRank.ViceScum]: 'Vice Scum',
    [PlayerRank.Scum]: 'Scum',
  }

  return {
    youGive: humanGave?.cards ?? [],
    youReceive: humanReceived?.cards ?? [],
    otherPlayerName: other?.name ?? '',
    yourRole: human?.rank != null ? roleNames[human.rank] : '',
  }
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
