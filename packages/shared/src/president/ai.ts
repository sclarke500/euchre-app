// President AI logic

import type { StandardCard } from '../core/types.js'
import type { PresidentPile, PresidentPlayer, PresidentGameState } from './types.js'
import {
  findValidPlays,
  canPlay,
  groupCardsByRank,
  getPresidentRankValue,
  sortHandByRank,
  getHighestCards,
  getLowestCards,
} from './play.js'

/**
 * AI chooses cards to play
 * Returns null to pass
 */
export function choosePresidentPlay(
  player: PresidentPlayer,
  pile: PresidentPile,
  state: PresidentGameState
): StandardCard[] | null {
  const validPlays = findValidPlays(player.hand, pile, state.superTwosMode)

  if (validPlays.length === 0) {
    return null // Must pass
  }

  // Strategy depends on hand size and game state
  const handSize = player.hand.length
  const activePlayers = state.players.filter(p => p.finishOrder === null).length

  // If only 2 cards left and can play, go for the win
  if (handSize <= 2) {
    return chooseAggressivePlay(validPlays, player.hand)
  }

  // If leading (empty pile), choose strategically
  if (pile.currentRank === null) {
    return chooseLeadPlay(validPlays, player.hand, activePlayers)
  }

  // Following - play lowest valid option
  return chooseLowestPlay(validPlays)
}

/**
 * Choose play when leading (pile is empty)
 */
function chooseLeadPlay(
  validPlays: StandardCard[][],
  hand: StandardCard[],
  activePlayers: number
): StandardCard[] {
  const groups = groupCardsByRank(hand)

  // Prefer to lead with pairs/triples if we have them
  // This clears more cards at once
  const multiCardPlays = validPlays.filter(p => p.length > 1)
  if (multiCardPlays.length > 0) {
    // Lead with lowest multi-card play
    return chooseLowestPlay(multiCardPlays)
  }

  // Lead with a mid-range single to draw out higher cards
  const singles = validPlays.filter(p => p.length === 1)
  if (singles.length > 0) {
    // Sort by rank value
    singles.sort((a, b) =>
      getPresidentRankValue(a[0]!.rank) - getPresidentRankValue(b[0]!.rank)
    )

    // Play from the lower-middle of our hand
    const midIndex = Math.floor(singles.length / 3)
    return singles[midIndex] ?? singles[0]!
  }

  return validPlays[0]!
}

/**
 * Choose the lowest valid play
 */
function chooseLowestPlay(validPlays: StandardCard[][]): StandardCard[] {
  if (validPlays.length === 0) {
    throw new Error('No valid plays')
  }

  // Sort by rank value (lowest first)
  const sorted = [...validPlays].sort((a, b) =>
    getPresidentRankValue(a[0]!.rank) - getPresidentRankValue(b[0]!.rank)
  )

  return sorted[0]!
}

/**
 * Choose aggressive play when close to winning
 */
function chooseAggressivePlay(
  validPlays: StandardCard[][],
  hand: StandardCard[]
): StandardCard[] {
  // If we can empty our hand, do it
  const winningPlay = validPlays.find(p => p.length === hand.length)
  if (winningPlay) {
    return winningPlay
  }

  // Otherwise play our highest cards to hopefully clear the pile and lead
  const sorted = [...validPlays].sort((a, b) =>
    getPresidentRankValue(b[0]!.rank) - getPresidentRankValue(a[0]!.rank)
  )

  return sorted[0]!
}

/**
 * Decide whether to pass even when we could play
 * (Sometimes strategically beneficial to hold good cards)
 */
export function shouldPass(
  player: PresidentPlayer,
  pile: PresidentPile,
  state: PresidentGameState
): boolean {
  // Never pass if we can't play
  if (!canPlay(player.hand, pile, state.superTwosMode)) {
    return true
  }

  // Never pass if pile is empty (we're leading)
  if (pile.currentRank === null) {
    return false
  }

  // For now, always play if we can
  // More sophisticated AI could hold high cards strategically
  return false
}

/**
 * Choose cards to give during card exchange (for Scum/Vice-Scum)
 * Must give best cards to President/VP
 */
export function chooseCardsToGive(
  player: PresidentPlayer,
  count: number
): StandardCard[] {
  // Scum gives their best cards
  return getHighestCards(player.hand, count)
}

/**
 * Choose cards to give back during reverse exchange (for President/VP)
 * Give worst cards to Scum/Vice-Scum
 */
export function chooseCardsToGiveBack(
  player: PresidentPlayer,
  count: number
): StandardCard[] {
  return getLowestCards(player.hand, count)
}
