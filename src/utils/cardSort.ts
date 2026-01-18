import type { Card } from '@/models/types'
import { Suit, Rank } from '@/models/types'

const suitOrder: Record<Suit, number> = {
  [Suit.Spades]: 0,
  [Suit.Hearts]: 1,
  [Suit.Diamonds]: 2,
  [Suit.Clubs]: 3,
}

const rankOrder: Record<Rank, number> = {
  [Rank.Nine]: 0,
  [Rank.Ten]: 1,
  [Rank.Jack]: 2,
  [Rank.Queen]: 3,
  [Rank.King]: 4,
  [Rank.Ace]: 5,
}

/**
 * Get the suit of the same color as the given suit
 */
function getSameColorSuit(suit: Suit): Suit {
  switch (suit) {
    case Suit.Hearts:
      return Suit.Diamonds
    case Suit.Diamonds:
      return Suit.Hearts
    case Suit.Spades:
      return Suit.Clubs
    case Suit.Clubs:
      return Suit.Spades
  }
}

/**
 * Get the effective suit of a card (handles left bower)
 */
function getEffectiveSuit(card: Card, trump: Suit | null): Suit {
  if (!trump) return card.suit

  // Left bower (Jack of same color as trump) is considered trump suit
  if (card.rank === Rank.Jack && card.suit === getSameColorSuit(trump)) {
    return trump
  }

  return card.suit
}

/**
 * Get card value for sorting in trump context
 * Higher values = better cards (for descending sort)
 * Order: Right Bower > Left Bower > Ace of Trump > King > Queen > 10 > 9
 */
function getCardSortValue(card: Card, trump: Suit | null): number {
  if (!trump) {
    return rankOrder[card.rank]
  }

  const effectiveSuit = getEffectiveSuit(card, trump)

  // Right bower (Jack of trump suit) - highest value
  if (card.rank === Rank.Jack && card.suit === trump) {
    return 1000
  }

  // Left bower (Jack of same color as trump) - second highest
  if (card.rank === Rank.Jack && card.suit === getSameColorSuit(trump)) {
    return 900
  }

  // Other trump cards - use base rank order starting from high value
  if (effectiveSuit === trump) {
    return 100 + rankOrder[card.rank]
  }

  // Non-trump cards - use base rank order
  return rankOrder[card.rank]
}

/**
 * Sort cards by suit (trump first) then rank (highest first)
 */
export function sortCards(cards: Card[], trump: Suit | null = null): Card[] {
  return [...cards].sort((a, b) => {
    const effectiveSuitA = getEffectiveSuit(a, trump)
    const effectiveSuitB = getEffectiveSuit(b, trump)

    // If trump is set, trump suit comes first
    if (trump) {
      const aIsTrump = effectiveSuitA === trump
      const bIsTrump = effectiveSuitB === trump

      if (aIsTrump && !bIsTrump) return -1
      if (!aIsTrump && bIsTrump) return 1
    }

    // Same suit: sort by value (descending - highest first)
    if (effectiveSuitA === effectiveSuitB) {
      const valueA = getCardSortValue(a, trump)
      const valueB = getCardSortValue(b, trump)
      return valueB - valueA // Descending order
    }

    // Different suits: sort by suit order
    return suitOrder[effectiveSuitA] - suitOrder[effectiveSuitB]
  })
}
