// President play validation and card utilities

import { FullRank } from '../core/types.js'
import type { StandardCard } from '../core/types.js'
import type { PresidentPile, PresidentPlay, PlayType } from './types.js'

/**
 * Get the value of a rank in President
 * 3 is lowest (1), 2 is highest (13)
 */
export function getPresidentRankValue(rank: FullRank): number {
  const values: Record<FullRank, number> = {
    [FullRank.Three]: 1,
    [FullRank.Four]: 2,
    [FullRank.Five]: 3,
    [FullRank.Six]: 4,
    [FullRank.Seven]: 5,
    [FullRank.Eight]: 6,
    [FullRank.Nine]: 7,
    [FullRank.Ten]: 8,
    [FullRank.Jack]: 9,
    [FullRank.Queen]: 10,
    [FullRank.King]: 11,
    [FullRank.Ace]: 12,
    [FullRank.Two]: 13,  // Highest!
  }
  return values[rank]
}

/**
 * Compare two ranks in President
 * Returns positive if rank1 > rank2, negative if rank1 < rank2
 */
export function compareRanks(rank1: FullRank, rank2: FullRank): number {
  return getPresidentRankValue(rank1) - getPresidentRankValue(rank2)
}

/**
 * Get the play type based on number of cards
 */
export function getPlayType(numCards: number): PlayType | null {
  switch (numCards) {
    case 1: return 'single'
    case 2: return 'pair'
    case 3: return 'triple'
    case 4: return 'quad'
    default: return null
  }
}

/**
 * Get the number of cards for a play type
 */
export function getPlayTypeCount(playType: PlayType): number {
  switch (playType) {
    case 'single': return 1
    case 'pair': return 2
    case 'triple': return 3
    case 'quad': return 4
  }
}

/**
 * Check if all cards in a set have the same rank
 */
export function allSameRank(cards: StandardCard[]): boolean {
  if (cards.length === 0) return false
  const firstRank = cards[0]!.rank
  return cards.every(card => card.rank === firstRank)
}

/**
 * Validate a play against the current pile
 */
export function isValidPlay(cards: StandardCard[], pile: PresidentPile): boolean {
  // Must have 1-4 cards
  if (cards.length === 0 || cards.length > 4) {
    return false
  }

  // All cards must be same rank
  if (!allSameRank(cards)) {
    return false
  }

  const playType = getPlayType(cards.length)
  if (!playType) {
    return false
  }

  // First play of round - anything goes
  if (pile.currentRank === null) {
    return true
  }

  // Must match pile's play type
  if (pile.currentPlayType && playType !== pile.currentPlayType) {
    return false
  }

  // Must beat current rank
  const playRank = cards[0]!.rank
  return compareRanks(playRank, pile.currentRank) > 0
}

/**
 * Group cards in hand by rank
 * Returns a map of rank -> cards
 */
export function groupCardsByRank(hand: StandardCard[]): Map<FullRank, StandardCard[]> {
  const groups = new Map<FullRank, StandardCard[]>()

  for (const card of hand) {
    const existing = groups.get(card.rank) ?? []
    existing.push(card)
    groups.set(card.rank, existing)
  }

  return groups
}

/**
 * Find all valid plays from a hand given the current pile
 */
export function findValidPlays(hand: StandardCard[], pile: PresidentPile): StandardCard[][] {
  const validPlays: StandardCard[][] = []
  const groups = groupCardsByRank(hand)

  // Determine required play type
  const requiredCount = pile.currentPlayType
    ? getPlayTypeCount(pile.currentPlayType)
    : null

  for (const [rank, cards] of groups) {
    // Skip if we can't beat current rank
    if (pile.currentRank !== null && compareRanks(rank, pile.currentRank) <= 0) {
      continue
    }

    // If pile is empty, we can play any combo size we have cards for
    if (requiredCount === null) {
      // Add all possible play sizes
      for (let size = 1; size <= cards.length; size++) {
        validPlays.push(cards.slice(0, size))
      }
    } else {
      // Must match required count
      if (cards.length >= requiredCount) {
        validPlays.push(cards.slice(0, requiredCount))
      }
    }
  }

  return validPlays
}

/**
 * Check if player can make any valid play
 */
export function canPlay(hand: StandardCard[], pile: PresidentPile): boolean {
  return findValidPlays(hand, pile).length > 0
}

/**
 * Create a PresidentPlay from cards
 */
export function createPlay(cards: StandardCard[], playerId: number): PresidentPlay | null {
  if (!allSameRank(cards) || cards.length === 0 || cards.length > 4) {
    return null
  }

  const playType = getPlayType(cards.length)
  if (!playType) {
    return null
  }

  return {
    cards,
    playerId,
    playType,
    rank: cards[0]!.rank,
  }
}

/**
 * Create an empty pile
 */
export function createEmptyPile(): PresidentPile {
  return {
    plays: [],
    currentPlayType: null,
    currentRank: null,
  }
}

/**
 * Add a play to the pile
 */
export function addPlayToPile(pile: PresidentPile, play: PresidentPlay): PresidentPile {
  return {
    plays: [...pile.plays, play],
    currentPlayType: play.playType,
    currentRank: play.rank,
  }
}

/**
 * Sort hand by rank (low to high for President)
 */
export function sortHandByRank(hand: StandardCard[]): StandardCard[] {
  return [...hand].sort((a, b) => compareRanks(a.rank, b.rank))
}

/**
 * Get the lowest cards from hand (for giving to President)
 */
export function getLowestCards(hand: StandardCard[], count: number): StandardCard[] {
  const sorted = sortHandByRank(hand)
  return sorted.slice(0, count)
}

/**
 * Get the highest cards from hand (for giving to Scum)
 */
export function getHighestCards(hand: StandardCard[], count: number): StandardCard[] {
  const sorted = sortHandByRank(hand)
  return sorted.slice(-count)
}
