import type { Card, Suit } from './types.js'
import { Suit as SuitEnum, Rank } from './types.js'

/**
 * Create a standard Euchre deck (24 cards: 9, 10, J, Q, K, A in all suits)
 */
export function createDeck(): Card[] {
  const deck: Card[] = []
  const suits = Object.values(SuitEnum)
  const ranks = Object.values(Rank)

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        suit,
        rank,
        id: `${suit}-${rank}`,
      })
    }
  }

  return deck
}

/**
 * Shuffle a deck using Fisher-Yates algorithm
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]!
    shuffled[j] = temp!
  }

  return shuffled
}

/**
 * Deal cards to 4 players (5 cards each) and return kitty (4 cards)
 * Returns [player0Hand, player1Hand, player2Hand, player3Hand, kitty]
 */
export function dealCards(deck: Card[]): [Card[], Card[], Card[], Card[], Card[]] {
  const shuffled = shuffleDeck(deck)

  // Deal 5 cards to each of 4 players
  const player0Hand = shuffled.slice(0, 5)
  const player1Hand = shuffled.slice(5, 10)
  const player2Hand = shuffled.slice(10, 15)
  const player3Hand = shuffled.slice(15, 20)
  const kitty = shuffled.slice(20, 24)

  return [player0Hand, player1Hand, player2Hand, player3Hand, kitty]
}

/**
 * Get the value of a card for trump comparison
 * Higher value = stronger card
 */
export function getCardValue(card: Card, trump: Suit, leadingSuit: Suit | null): number {
  const { suit, rank } = card

  // Right bower (Jack of trump suit) - highest card
  if (rank === Rank.Jack && suit === trump) {
    return 100
  }

  // Left bower (Jack of same color as trump) - second highest
  const leftBowerSuit = getSameColorSuit(trump)
  if (rank === Rank.Jack && suit === leftBowerSuit) {
    return 90
  }

  // Trump cards (non-Jack)
  if (suit === trump) {
    return 50 + getRankValue(rank)
  }

  // Leading suit cards (if not trump)
  if (leadingSuit && suit === leadingSuit) {
    return 20 + getRankValue(rank)
  }

  // Off-suit cards (lowest)
  return getRankValue(rank)
}

/**
 * Get the base value of a rank
 */
function getRankValue(rank: Rank): number {
  switch (rank) {
    case Rank.Nine:
      return 1
    case Rank.Ten:
      return 2
    case Rank.Jack:
      return 3
    case Rank.Queen:
      return 4
    case Rank.King:
      return 5
    case Rank.Ace:
      return 6
    default:
      return 0
  }
}

/**
 * Get the suit of the same color (for left bower determination)
 */
export function getSameColorSuit(suit: Suit): Suit {
  switch (suit) {
    case SuitEnum.Hearts:
      return SuitEnum.Diamonds
    case SuitEnum.Diamonds:
      return SuitEnum.Hearts
    case SuitEnum.Clubs:
      return SuitEnum.Spades
    case SuitEnum.Spades:
      return SuitEnum.Clubs
  }
}

/**
 * Get the effective suit of a card (important for left bower)
 */
export function getEffectiveSuit(card: Card, trump: Suit): Suit {
  // Left bower is considered trump suit
  if (card.rank === Rank.Jack && card.suit === getSameColorSuit(trump)) {
    return trump
  }
  return card.suit
}

/**
 * Compare two cards to determine which is stronger
 * Returns positive if card1 is stronger, negative if card2 is stronger, 0 if equal
 */
export function compareCards(
  card1: Card,
  card2: Card,
  trump: Suit,
  leadingSuit: Suit | null
): number {
  const value1 = getCardValue(card1, trump, leadingSuit)
  const value2 = getCardValue(card2, trump, leadingSuit)
  return value1 - value2
}
