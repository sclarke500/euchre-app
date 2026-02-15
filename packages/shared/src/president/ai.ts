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
 * Easy AI - simple, predictable play (always plays lowest valid)
 * Returns null to pass
 */
export function choosePresidentPlay(
  player: PresidentPlayer,
  pile: PresidentPile,
  state: PresidentGameState
): StandardCard[] | null {
  const validPlays = findValidPlays(player.hand, pile, state.rules.superTwosMode)

  if (validPlays.length === 0) {
    return null // Must pass
  }

  // Easy AI: just play the lowest valid option
  // Sometimes randomly passes even when could play (makes mistakes)
  if (pile.currentRank !== null && Math.random() < 0.1) {
    return null // Random pass 10% of the time
  }

  return chooseLowestPlay(validPlays)
}

/**
 * Hard AI - strategic play with card counting and timing
 * Returns null to pass
 */
export function choosePresidentPlayHard(
  player: PresidentPlayer,
  pile: PresidentPile,
  state: PresidentGameState
): StandardCard[] | null {
  const validPlays = findValidPlays(player.hand, pile, state.rules.superTwosMode)

  if (validPlays.length === 0) {
    return null // Must pass
  }

  const handSize = player.hand.length
  const activePlayers = state.players.filter(p => p.finishOrder === null).length

  // If only 2 cards left and can play, go for the win
  if (handSize <= 2) {
    return chooseAggressivePlay(validPlays, player.hand)
  }

  // If leading (empty pile), choose strategically
  if (pile.currentRank === null) {
    return chooseLeadPlayHard(validPlays, player.hand, activePlayers)
  }

  // Following - strategic play
  return chooseFollowPlayHard(validPlays, player.hand, pile, state)
}

/**
 * Hard AI: Choose play when leading (pile is empty)
 */
function chooseLeadPlayHard(
  validPlays: StandardCard[][],
  hand: StandardCard[],
  activePlayers: number
): StandardCard[] {
  // Prefer to lead with pairs/triples - clears more cards
  const multiCardPlays = validPlays.filter(p => p.length > 1)
  if (multiCardPlays.length > 0) {
    // Lead with lowest multi-card play to save high pairs for later
    return chooseLowestPlay(multiCardPlays)
  }

  // Lead with mid-range singles to draw out higher cards
  const singles = validPlays.filter(p => p.length === 1)
  if (singles.length > 0) {
    singles.sort((a, b) =>
      getPresidentRankValue(a[0]!.rank) - getPresidentRankValue(b[0]!.rank)
    )

    // If few players left, lead higher to clear the pile
    if (activePlayers <= 2) {
      return singles[Math.floor(singles.length * 0.6)] ?? singles[0]!
    }

    // Otherwise lead from lower-middle
    const midIndex = Math.floor(singles.length / 3)
    return singles[midIndex] ?? singles[0]!
  }

  return validPlays[0]!
}

/**
 * Hard AI: Choose play when following (pile has cards)
 */
function chooseFollowPlayHard(
  validPlays: StandardCard[][],
  hand: StandardCard[],
  pile: PresidentPile,
  state: PresidentGameState
): StandardCard[] {
  const sorted = [...validPlays].sort((a, b) =>
    getPresidentRankValue(a[0]!.rank) - getPresidentRankValue(b[0]!.rank)
  )

  // Count how many 2s we have (they clear the pile)
  const twosInHand = hand.filter(c => c.rank === '2').length
  const hasTwos = twosInHand > 0

  // If pile is getting high and we have 2s, consider saving them
  const pileValue = pile.currentRank ? getPresidentRankValue(pile.currentRank) : 0
  
  // If pile is Ace-level (14) and we can play 2s, use them to clear
  if (pileValue >= 14 && hasTwos) {
    const twoPlays = validPlays.filter(p => p[0]?.rank === '2')
    if (twoPlays.length > 0) {
      return twoPlays[0]!
    }
  }

  // If we only have high cards left, just play them
  const lowestPlayValue = getPresidentRankValue(sorted[0]![0]!.rank)
  if (lowestPlayValue >= 12) { // Q or higher
    return sorted[0]!
  }

  // Play the lowest valid option to save high cards
  return sorted[0]!
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
  if (!canPlay(player.hand, pile, state.rules.superTwosMode)) {
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
