// Spades trick handling logic

import { Suit, FullRank } from '../core/types.js'
import type { StandardCard, PlayedCard } from '../core/types.js'
import {
  SpadesPhase,
  type SpadesGameState,
  type SpadesTrick,
} from './types.js'
import { createSpadesTrick, completeRound, startNewRound } from './game.js'

/**
 * Get card value for comparison
 * Spades are always trump
 */
export function getSpadesCardValue(
  card: StandardCard,
  leadingSuit: Suit | null
): number {
  const rankValues: Record<FullRank, number> = {
    [FullRank.Two]: 2,
    [FullRank.Three]: 3,
    [FullRank.Four]: 4,
    [FullRank.Five]: 5,
    [FullRank.Six]: 6,
    [FullRank.Seven]: 7,
    [FullRank.Eight]: 8,
    [FullRank.Nine]: 9,
    [FullRank.Ten]: 10,
    [FullRank.Jack]: 11,
    [FullRank.Queen]: 12,
    [FullRank.King]: 13,
    [FullRank.Ace]: 14,
    [FullRank.Joker]: 0, // Not used in standard Spades
  }

  const baseValue = rankValues[card.rank] ?? 0

  // Spades (trump) are always highest
  if (card.suit === Suit.Spades) {
    return 100 + baseValue
  }

  // Cards matching leading suit
  if (leadingSuit && card.suit === leadingSuit) {
    return 50 + baseValue
  }

  // Off-suit cards (can't win)
  return baseValue
}

/**
 * Check if a card can legally be played
 */
export function isLegalPlay(
  card: StandardCard,
  hand: StandardCard[],
  trick: SpadesTrick,
  spadesBroken: boolean
): boolean {
  // First card of trick
  if (trick.cards.length === 0) {
    // Can't lead spades unless broken (or only have spades)
    if (card.suit === Suit.Spades && !spadesBroken) {
      const hasNonSpade = hand.some(c => c.suit !== Suit.Spades)
      if (hasNonSpade) return false
    }
    return true
  }

  const leadingSuit = trick.leadingSuit
  if (!leadingSuit) return true

  // Must follow suit if able
  if (card.suit === leadingSuit) return true

  // Check if player has any cards of leading suit
  const hasLeadingSuit = hand.some(c => c.suit === leadingSuit)
  if (hasLeadingSuit) return false

  // Can play anything (including spades) if void in led suit
  return true
}

/**
 * Get all legal plays from hand
 */
export function getLegalPlays(
  hand: StandardCard[],
  trick: SpadesTrick,
  spadesBroken: boolean
): StandardCard[] {
  return hand.filter(card => isLegalPlay(card, hand, trick, spadesBroken))
}

/**
 * Determine the winner of a completed trick
 */
export function determineTrickWinner(trick: SpadesTrick): number {
  if (trick.cards.length === 0) {
    throw new Error('Cannot determine winner of empty trick')
  }

  let winningCard = trick.cards[0]!
  let winnerId = winningCard.playerId

  for (let i = 1; i < trick.cards.length; i++) {
    const currentCard = trick.cards[i]!
    const currentValue = getSpadesCardValue(currentCard.card, trick.leadingSuit)
    const winningValue = getSpadesCardValue(winningCard.card, trick.leadingSuit)

    if (currentValue > winningValue) {
      winningCard = currentCard
      winnerId = currentCard.playerId
    }
  }

  return winnerId
}

/**
 * Play a card to the current trick
 */
export function playCard(
  state: SpadesGameState,
  playerId: number,
  card: StandardCard
): SpadesGameState {
  if (state.phase !== SpadesPhase.Playing) return state
  if (state.currentPlayer !== playerId) return state

  const player = state.players[playerId]
  if (!player) return state

  // Verify card is in player's hand
  const cardIndex = player.hand.findIndex(c => c.id === card.id)
  if (cardIndex === -1) return state

  // Verify it's a legal play
  if (!isLegalPlay(card, player.hand, state.currentTrick, state.spadesBroken)) {
    return state
  }

  // Remove card from hand
  const newHand = [...player.hand]
  newHand.splice(cardIndex, 1)

  const players = state.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand } : p
  )

  // Add card to trick
  const playedCard: PlayedCard<FullRank> = { card, playerId }
  const cards = [...state.currentTrick.cards, playedCard]

  // Set leading suit if first card
  let leadingSuit = state.currentTrick.leadingSuit
  if (cards.length === 1) {
    leadingSuit = card.suit
  }

  // Check if spades are now broken
  const spadesBroken = state.spadesBroken || card.suit === Suit.Spades

  const currentTrick: SpadesTrick = {
    cards,
    leadingSuit,
    winnerId: null,
  }

  // Check if trick is complete (4 cards)
  if (cards.length === 4) {
    const winnerId = determineTrickWinner(currentTrick)
    const completedTrick: SpadesTrick = { ...currentTrick, winnerId }

    // Update winner's tricks won
    const updatedPlayers = players.map(p =>
      p.id === winnerId ? { ...p, tricksWon: p.tricksWon + 1 } : p
    )

    const completedTricks = [...state.completedTricks, completedTrick]

    // Check if round is complete (13 tricks)
    if (completedTricks.length === 13) {
      return completeRound({
        ...state,
        players: updatedPlayers,
        currentTrick: createSpadesTrick(),
        completedTricks,
        spadesBroken,
        phase: SpadesPhase.TrickComplete,
      })
    }

    // Trick winner leads next
    return {
      ...state,
      players: updatedPlayers,
      currentTrick: createSpadesTrick(),
      completedTricks,
      currentPlayer: winnerId,
      spadesBroken,
      phase: SpadesPhase.TrickComplete,
    }
  }

  // Move to next player
  return {
    ...state,
    players,
    currentTrick,
    currentPlayer: (playerId + 1) % 4,
    spadesBroken,
  }
}

/**
 * Continue to next trick after trick complete
 */
export function continuePlay(state: SpadesGameState): SpadesGameState {
  if (state.phase !== SpadesPhase.TrickComplete) return state

  // If round is complete, this is called to start new round
  if (state.completedTricks.length === 13) {
    if (state.gameOver) return state
    return startNewRound(state)
  }

  return {
    ...state,
    phase: SpadesPhase.Playing,
    currentTrick: createSpadesTrick(),
  }
}

/**
 * Count tricks won by each team
 */
export function countTricksByTeam(tricks: SpadesTrick[]): [number, number] {
  let team0 = 0
  let team1 = 0

  for (const trick of tricks) {
    if (trick.winnerId === null) continue
    if (trick.winnerId % 2 === 0) team0++
    else team1++
  }

  return [team0, team1]
}
