// Spades game logic

import { Suit } from '../core/types.js'
import type { StandardCard } from '../core/types.js'
import { createStandardDeck, shuffleDeck } from '../core/deck.js'
import {
  SpadesPhase,
  SpadesBidType,
  type SpadesGameState,
  type SpadesPlayer,
  type SpadesTrick,
  type SpadesBid,
  type SpadesTeamScore,
  type SpadesRoundScore,
} from './types.js'

/**
 * Create an empty trick
 */
export function createSpadesTrick(): SpadesTrick {
  return {
    cards: [],
    leadingSuit: null,
    winnerId: null,
  }
}

/**
 * Create initial player
 */
export function createSpadesPlayer(
  id: number,
  name: string,
  isHuman: boolean
): SpadesPlayer {
  return {
    id,
    name,
    hand: [],
    isHuman,
    teamId: id % 2, // 0 & 2 are team 0, 1 & 3 are team 1
    bid: null,
    tricksWon: 0,
  }
}

/**
 * Create a new Spades game
 */
export function createSpadesGame(
  playerNames: string[],
  humanPlayerIndex: number = 0,
  winScore: number = 500,
  loseScore: number = -200
): SpadesGameState {
  if (playerNames.length !== 4) {
    throw new Error('Spades requires exactly 4 players')
  }

  const players: SpadesPlayer[] = playerNames.map((name, i) =>
    createSpadesPlayer(i, name, i === humanPlayerIndex)
  )

  return {
    gameType: 'spades',
    players,
    phase: SpadesPhase.Setup,
    currentTrick: createSpadesTrick(),
    completedTricks: [],
    currentPlayer: 0,
    dealer: Math.floor(Math.random() * 4), // Random starting dealer
    scores: [
      { teamId: 0, score: 0, bags: 0 },
      { teamId: 1, score: 0, bags: 0 },
    ],
    roundNumber: 1,
    gameOver: false,
    winner: null,
    spadesBroken: false,
    bidsComplete: false,
    winScore,
    loseScore,
  }
}

/**
 * Deal cards to all players (13 each)
 */
export function dealSpadesCards(state: SpadesGameState): SpadesGameState {
  const deck = createStandardDeck()
  const shuffled = shuffleDeck(deck)

  // Deal 13 cards to each of 4 players
  const players = state.players.map((player, i) => ({
    ...player,
    hand: shuffled.slice(i * 13, (i + 1) * 13),
    bid: null,
    tricksWon: 0,
  }))

  // Player left of dealer starts bidding
  const firstBidder = (state.dealer + 1) % 4

  return {
    ...state,
    players,
    phase: SpadesPhase.Dealing,
    currentTrick: createSpadesTrick(),
    completedTricks: [],
    currentPlayer: firstBidder,
    spadesBroken: false,
    bidsComplete: false,
  }
}

/**
 * Start bidding phase
 */
export function startBiddingPhase(state: SpadesGameState): SpadesGameState {
  return {
    ...state,
    phase: SpadesPhase.Bidding,
    currentPlayer: (state.dealer + 1) % 4,
  }
}

/**
 * Process a player's bid
 */
export function processBid(
  state: SpadesGameState,
  playerId: number,
  bid: SpadesBid
): SpadesGameState {
  if (state.phase !== SpadesPhase.Bidding) return state
  if (state.currentPlayer !== playerId) return state

  const player = state.players[playerId]
  if (!player || player.bid !== null) return state

  // Validate bid
  if (bid.type === SpadesBidType.Normal && (bid.count < 0 || bid.count > 13)) {
    return state
  }

  // Update player's bid
  const players = state.players.map(p =>
    p.id === playerId ? { ...p, bid } : p
  )

  // Check if all players have bid
  const allBid = players.every(p => p.bid !== null)

  if (allBid) {
    // Start playing phase
    const firstPlayer = (state.dealer + 1) % 4
    return {
      ...state,
      players,
      phase: SpadesPhase.Playing,
      currentPlayer: firstPlayer,
      bidsComplete: true,
    }
  }

  // Move to next player
  return {
    ...state,
    players,
    currentPlayer: (playerId + 1) % 4,
  }
}

/**
 * Get team's combined bid (excluding nil bids for bag calculation)
 */
export function getTeamBid(players: SpadesPlayer[], teamId: number): number {
  return players
    .filter(p => p.teamId === teamId)
    .reduce((sum, p) => {
      if (!p.bid) return sum
      // Nil/BlindNil don't count toward team bid
      if (p.bid.type !== SpadesBidType.Normal) return sum
      return sum + p.bid.count
    }, 0)
}

/**
 * Get team's tricks won
 */
export function getTeamTricks(players: SpadesPlayer[], teamId: number): number {
  return players
    .filter(p => p.teamId === teamId)
    .reduce((sum, p) => sum + p.tricksWon, 0)
}

/**
 * Calculate round score for a team
 */
export function calculateRoundScore(
  players: SpadesPlayer[],
  teamId: number,
  currentBags: number
): SpadesRoundScore {
  const teamPlayers = players.filter(p => p.teamId === teamId)
  const teamBid = getTeamBid(players, teamId)
  const tricksWon = getTeamTricks(players, teamId)

  let nilBonus = 0
  let nilPenalty = 0

  // Process nil bids
  for (const player of teamPlayers) {
    if (!player.bid) continue

    if (player.bid.type === SpadesBidType.Nil) {
      if (player.tricksWon === 0) {
        nilBonus += 100
      } else {
        nilPenalty += 100
      }
    } else if (player.bid.type === SpadesBidType.BlindNil) {
      if (player.tricksWon === 0) {
        nilBonus += 200
      } else {
        nilPenalty += 200
      }
    }
  }

  // Calculate regular scoring (for non-nil bids)
  let baseScore = 0
  let newBags = 0

  if (teamBid > 0) {
    if (tricksWon >= teamBid) {
      // Made bid: 10 × bid + 1 per overtrick (bag)
      newBags = tricksWon - teamBid
      baseScore = teamBid * 10 + newBags
    } else {
      // Failed bid: -10 × bid
      baseScore = -teamBid * 10
    }
  }

  // Calculate bag penalty (every 10 bags = -100)
  const totalBags = currentBags + newBags
  const bagsPenalty = Math.floor(totalBags / 10) * -100
  const remainingBags = totalBags % 10

  const roundPoints = baseScore + nilBonus - nilPenalty + bagsPenalty

  return {
    teamId,
    baseBid: teamBid,
    tricksWon,
    bagsPenalty,
    nilBonus,
    nilPenalty,
    roundPoints,
  }
}

/**
 * Apply round scores and check for game end
 */
export function completeRound(state: SpadesGameState): SpadesGameState {
  const team0Score = calculateRoundScore(state.players, 0, state.scores[0]?.bags ?? 0)
  const team1Score = calculateRoundScore(state.players, 1, state.scores[1]?.bags ?? 0)

  // Update scores
  // Bags only accumulate when you get MORE tricks than bid (overtricks)
  const team0Overtricks = Math.max(0, team0Score.tricksWon - team0Score.baseBid)
  const team1Overtricks = Math.max(0, team1Score.tricksWon - team1Score.baseBid)
  
  const scores: SpadesTeamScore[] = [
    {
      teamId: 0,
      score: (state.scores[0]?.score ?? 0) + team0Score.roundPoints,
      bags: ((state.scores[0]?.bags ?? 0) + team0Overtricks) % 10,
    },
    {
      teamId: 1,
      score: (state.scores[1]?.score ?? 0) + team1Score.roundPoints,
      bags: ((state.scores[1]?.bags ?? 0) + team1Overtricks) % 10,
    },
  ]

  // Check for game end
  let gameOver = false
  let winner: number | null = null

  // Check win condition
  if (scores[0]!.score >= state.winScore && scores[0]!.score > scores[1]!.score) {
    gameOver = true
    winner = 0
  } else if (scores[1]!.score >= state.winScore && scores[1]!.score > scores[0]!.score) {
    gameOver = true
    winner = 1
  }
  // If both reach win score, higher score wins
  else if (scores[0]!.score >= state.winScore && scores[1]!.score >= state.winScore) {
    gameOver = true
    winner = scores[0]!.score >= scores[1]!.score ? 0 : 1
  }

  // Check lose condition
  if (scores[0]!.score <= state.loseScore) {
    gameOver = true
    winner = 1
  } else if (scores[1]!.score <= state.loseScore) {
    gameOver = true
    winner = 0
  }

  return {
    ...state,
    scores,
    phase: gameOver ? SpadesPhase.GameOver : SpadesPhase.RoundComplete,
    gameOver,
    winner,
  }
}

/**
 * Start a new round
 */
export function startNewRound(state: SpadesGameState): SpadesGameState {
  // Rotate dealer
  const newDealer = (state.dealer + 1) % 4

  // Deal cards
  const dealtState = dealSpadesCards({
    ...state,
    dealer: newDealer,
    roundNumber: state.roundNumber + 1,
  })

  // Start bidding
  return startBiddingPhase(dealtState)
}
