/**
 * Pure Euchre state machine
 *
 * Hosts (SP store / server *Game) only apply results.
 * Illegal actions return the same state reference (next === prev).
 * Legal actions always return a new object.
 */

import type { Bid, Card, GameState, Player, Round, TeamScore, Trump } from './types.js'
import { BidAction, GamePhase } from './types.js'
import { createDeck, dealCards } from './deck.js'
import {
  completeTrick,
  createTrick,
  getLegalPlays,
  isPlayerSittingOut,
  isTrickComplete,
  playCardToTrick,
} from './trick.js'
import { processBid as processBidTrump } from './trump.js'
import {
  calculateRoundScore,
  getWinner,
  isGameOver,
  updateScores,
} from './scoring.js'

export interface EuchreRules {
  /** When true, dealer must call in R2 if everyone else passed. When false, R2 all-pass redeals. */
  stickTheDealer: boolean
  /** When true, ordering partner's turn-up forces going alone. */
  canadianLoner: boolean
}

export const DEFAULT_EUCHRE_RULES: EuchreRules = {
  stickTheDealer: false,
  canadianLoner: false,
}

/** Full pure game state (extends wire GameState fields with host-independent orchestration). */
export interface EuchreGameState extends GameState {
  currentDealer: number
  passCount: number
  biddingStartPlayer: number
  rules: EuchreRules
}

export type Rng = () => number

function nextSeat(seat: number, alonePlayer: number | null): number {
  let s = (seat + 1) % 4
  if (isPlayerSittingOut(s, alonePlayer)) {
    s = (s + 1) % 4
  }
  return s
}

function leadSeat(dealer: number, alonePlayer: number | null): number {
  return nextSeat(dealer, alonePlayer)
}

/**
 * Create a new game (Setup). Does not deal.
 */
export function createEuchreGame(
  playerNames: string[],
  humanPlayerIndex: number = 0,
  rules: Partial<EuchreRules> = {}
): EuchreGameState {
  if (playerNames.length !== 4) {
    throw new Error('Euchre requires exactly 4 players')
  }

  const players: Player[] = playerNames.map((name, i) => ({
    id: i,
    name,
    hand: [],
    isHuman: i === humanPlayerIndex,
    teamId: i % 2,
  }))

  return {
    players,
    currentRound: null,
    scores: [
      { teamId: 0, score: 0 },
      { teamId: 1, score: 0 },
    ],
    gameOver: false,
    winner: null,
    phase: GamePhase.Setup,
    currentDealer: 0,
    passCount: 0,
    biddingStartPlayer: 0,
    rules: { ...DEFAULT_EUCHRE_RULES, ...rules },
  }
}

/**
 * Deal a new round (phase Dealing). Optional rng for tests (default Math.random).
 */
export function dealRound(state: EuchreGameState, rng: Rng = Math.random): EuchreGameState {
  const [hand0, hand1, hand2, hand3, kitty] = dealCards(createDeck(), rng)
  const turnUpCard = kitty[0] ?? null
  const biddingStartPlayer = (state.currentDealer + 1) % 4

  const players = state.players.map((p, i) => ({
    ...p,
    hand: [hand0, hand1, hand2, hand3][i] ?? [],
  }))

  const currentRound: Round = {
    dealer: state.currentDealer,
    trump: null,
    tricks: [],
    currentTrick: createTrick(),
    kitty,
    turnUpCard,
    biddingRound: 1,
    currentPlayer: biddingStartPlayer,
    goingAlone: false,
    alonePlayer: null,
  }

  return {
    ...state,
    players,
    currentRound,
    phase: GamePhase.Dealing,
    passCount: 0,
    biddingStartPlayer,
    gameOver: false,
  }
}

/** Advance from Dealing → BiddingRound1 */
export function startBiddingRound1(state: EuchreGameState): EuchreGameState {
  if (state.phase !== GamePhase.Dealing || !state.currentRound) return state
  return {
    ...state,
    phase: GamePhase.BiddingRound1,
    currentRound: {
      ...state.currentRound,
      biddingRound: 1,
      currentPlayer: state.biddingStartPlayer,
    },
  }
}

/**
 * Apply a bid. Illegal → same reference.
 * R2 all-pass with can-pass: returns dealRound with rotated dealer (redeal).
 */
export function applyBid(state: EuchreGameState, bid: Bid): EuchreGameState {
  if (!state.currentRound) return state
  if (
    state.phase !== GamePhase.BiddingRound1 &&
    state.phase !== GamePhase.BiddingRound2
  ) {
    return state
  }
  if (state.currentRound.currentPlayer !== bid.playerId) return state

  const round = state.currentRound
  const dealer = round.dealer

  // Stick the dealer: dealer may not pass in R2 when three have already passed
  if (
    state.rules.stickTheDealer &&
    round.biddingRound === 2 &&
    bid.action === BidAction.Pass &&
    bid.playerId === dealer &&
    state.passCount >= 3
  ) {
    return state
  }

  // Canadian loner: ordering partner forces alone
  let effectiveBid = bid
  if (
    state.rules.canadianLoner &&
    bid.action === BidAction.OrderUp &&
    bid.playerId === (dealer + 2) % 4
  ) {
    effectiveBid = { ...bid, goingAlone: true }
  }

  if (effectiveBid.action === BidAction.Pass) {
    const passCount = state.passCount + 1

    if (round.biddingRound === 1) {
      if (passCount >= 4) {
        // → Round 2
        return {
          ...state,
          passCount: 0,
          phase: GamePhase.BiddingRound2,
          biddingStartPlayer: (dealer + 1) % 4,
          currentRound: {
            ...round,
            biddingRound: 2,
            currentPlayer: (dealer + 1) % 4,
          },
        }
      }
      return {
        ...state,
        passCount,
        currentRound: {
          ...round,
          currentPlayer: (round.currentPlayer + 1) % 4,
        },
      }
    }

    // Round 2 pass
    if (passCount >= 4) {
      if (state.rules.stickTheDealer) {
        // Should be unreachable if dealer can't pass; treat as reject
        return state
      }
      // Redeal: rotate dealer and deal
      return dealRound({
        ...state,
        currentDealer: (state.currentDealer + 1) % 4,
        passCount: 0,
        currentRound: null,
        phase: GamePhase.Setup,
      })
    }

    return {
      ...state,
      passCount,
      currentRound: {
        ...round,
        currentPlayer: (round.currentPlayer + 1) % 4,
      },
    }
  }

  // Trump-setting actions
  if (round.trump) return state // already set

  const newTrump = processBidTrump(effectiveBid, round.turnUpCard, round.trump)
  if (!newTrump) return state

  // Only OrderUp / PickUp / CallTrump set trump for first time
  if (
    effectiveBid.action !== BidAction.OrderUp &&
    effectiveBid.action !== BidAction.PickUp &&
    effectiveBid.action !== BidAction.CallTrump
  ) {
    return state
  }

  let players = state.players.map(p => ({ ...p, hand: [...p.hand] }))
  let phase: GamePhase = GamePhase.Playing
  let currentPlayer = leadSeat(dealer, newTrump.goingAlone ? newTrump.calledBy : null)
  let nextRound: Round = {
    ...round,
    trump: newTrump,
    goingAlone: newTrump.goingAlone,
    alonePlayer: newTrump.goingAlone ? newTrump.calledBy : null,
    currentPlayer,
  }

  // Dealer pickup path
  if (
    effectiveBid.action === BidAction.OrderUp ||
    effectiveBid.action === BidAction.PickUp
  ) {
    if (round.turnUpCard && !isPlayerSittingOut(dealer, nextRound.alonePlayer)) {
      // Add turn card to dealer hand → discard phase
      players = players.map(p =>
        p.id === dealer
          ? { ...p, hand: [...p.hand, round.turnUpCard!] }
          : p
      )
      phase = GamePhase.DealerDiscard
      currentPlayer = dealer
      nextRound = { ...nextRound, currentPlayer: dealer }
    }
  }

  return {
    ...state,
    players,
    phase,
    passCount: 0,
    currentRound: nextRound,
  }
}

/**
 * Dealer discards one card after pickup. Illegal → same ref.
 */
export function applyDealerDiscard(
  state: EuchreGameState,
  cardId: string
): EuchreGameState {
  if (state.phase !== GamePhase.DealerDiscard || !state.currentRound?.trump) {
    return state
  }
  const round = state.currentRound
  const dealer = round.dealer
  if (round.currentPlayer !== dealer) return state

  const dealerPlayer = state.players[dealer]
  if (!dealerPlayer) return state
  const cardIndex = dealerPlayer.hand.findIndex(c => c.id === cardId)
  if (cardIndex === -1) return state

  const players = state.players.map(p => {
    if (p.id !== dealer) return p
    const hand = [...p.hand]
    hand.splice(cardIndex, 1)
    return { ...p, hand }
  })

  const alonePlayer = round.alonePlayer
  const currentPlayer = leadSeat(dealer, alonePlayer)

  return {
    ...state,
    players,
    phase: GamePhase.Playing,
    currentRound: {
      ...round,
      currentPlayer,
    },
  }
}

/**
 * Play a card. Illegal → same ref.
 * On trick complete: appends trick, phase TrickComplete.
 * On 5th trick: applies scoring (RoundComplete / GameOver).
 */
export function applyPlay(
  state: EuchreGameState,
  playerId: number,
  cardId: string
): EuchreGameState {
  if (state.phase !== GamePhase.Playing || !state.currentRound?.trump) {
    return state
  }
  const round = state.currentRound
  const trump = round.trump
  if (!trump) return state
  if (round.currentPlayer !== playerId) return state
  if (isPlayerSittingOut(playerId, round.alonePlayer)) return state

  const player = state.players[playerId]
  if (!player) return state
  const card = player.hand.find(c => c.id === cardId)
  if (!card) return state

  const legal = getLegalPlays(player.hand, round.currentTrick, trump.suit)
  if (!legal.some(c => c.id === cardId)) return state

  const players = state.players.map(p => {
    if (p.id !== playerId) return p
    return { ...p, hand: p.hand.filter(c => c.id !== cardId) }
  })

  const currentTrick = playCardToTrick(
    round.currentTrick,
    card,
    playerId,
    trump.suit
  )

  if (isTrickComplete(currentTrick, round.goingAlone)) {
    const completed = completeTrick(currentTrick, trump.suit)
    const tricks = [...round.tricks, completed]

    if (tricks.length >= 5) {
      return finishRound({
        ...state,
        players,
        currentRound: {
          ...round,
          tricks,
          currentTrick: createTrick(),
        },
        phase: GamePhase.TrickComplete,
      })
    }

    return {
      ...state,
      players,
      phase: GamePhase.TrickComplete,
      currentRound: {
        ...round,
        tricks,
        currentTrick: createTrick(),
        currentPlayer: completed.winnerId ?? leadSeat(round.dealer, round.alonePlayer),
      },
    }
  }

  return {
    ...state,
    players,
    currentRound: {
      ...round,
      currentTrick,
      currentPlayer: nextSeat(playerId, round.alonePlayer),
    },
  }
}

/** After TrickComplete (mid-round): resume Playing. 5-trick rounds already scored. */
export function continueAfterTrick(state: EuchreGameState): EuchreGameState {
  if (state.phase !== GamePhase.TrickComplete || !state.currentRound) return state
  if (state.currentRound.tricks.length >= 5) return state

  return {
    ...state,
    phase: GamePhase.Playing,
  }
}

/**
 * Score the round (called from applyPlay on 5th trick, or host).
 */
export function finishRound(state: EuchreGameState): EuchreGameState {
  if (!state.currentRound?.trump) return state

  const roundScore = calculateRoundScore(
    state.currentRound.tricks,
    state.currentRound.trump
  )
  const currentScores: [number, number] = [
    state.scores[0]?.score ?? 0,
    state.scores[1]?.score ?? 0,
  ]
  const newScores = updateScores(currentScores, roundScore)
  const scores: TeamScore[] = [
    { teamId: 0, score: newScores[0] },
    { teamId: 1, score: newScores[1] },
  ]

  if (isGameOver(newScores)) {
    return {
      ...state,
      scores,
      gameOver: true,
      winner: getWinner(newScores),
      phase: GamePhase.GameOver,
    }
  }

  return {
    ...state,
    scores,
    phase: GamePhase.RoundComplete,
    gameOver: false,
    winner: null,
  }
}

/** Rotate dealer and deal next round (after RoundComplete). */
export function startNextRound(state: EuchreGameState, rng: Rng = Math.random): EuchreGameState {
  if (state.phase !== GamePhase.RoundComplete && state.phase !== GamePhase.Setup) {
    // Allow from RoundComplete primarily
  }
  return dealRound(
    {
      ...state,
      currentDealer: (state.currentDealer + 1) % 4,
      gameOver: false,
      winner: null,
    },
    rng
  )
}

export function getLegalCards(state: EuchreGameState, playerId: number): Card[] {
  if (state.phase !== GamePhase.Playing || !state.currentRound?.trump) return []
  const player = state.players[playerId]
  if (!player) return []
  return getLegalPlays(player.hand, state.currentRound.currentTrick, state.currentRound.trump.suit)
}
