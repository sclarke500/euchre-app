// Core deck operations shared across all card games

import { Suit, FullRank, EuchreRank } from './types.js'
import type { Card, StandardCard, EuchreCard } from './types.js'

/**
 * Shuffle a deck using Fisher-Yates algorithm
 * Generic - works with any card type
 */
export function shuffleDeck<T>(deck: T[]): T[] {
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
 * Create a standard 52-card deck (excludes jokers)
 */
export function createStandardDeck(): StandardCard[] {
  const deck: StandardCard[] = []
  const suits = Object.values(Suit)
  const ranks = Object.values(FullRank).filter(r => r !== FullRank.Joker)

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
 * Create a President deck (52 cards, optionally with 2 jokers = 54 cards)
 */
export function createPresidentDeck(withJokers: boolean = false): StandardCard[] {
  const deck = createStandardDeck()

  if (withJokers) {
    // Add 2 jokers (suit is arbitrary, doesn't affect President gameplay)
    deck.push({
      suit: Suit.Spades,
      rank: FullRank.Joker,
      id: 'joker-1',
    })
    deck.push({
      suit: Suit.Hearts,
      rank: FullRank.Joker,
      id: 'joker-2',
    })
  }

  return deck
}

/**
 * Create a Euchre deck (24 cards: 9, 10, J, Q, K, A in all suits)
 */
export function createEuchreDeck(): EuchreCard[] {
  const deck: EuchreCard[] = []
  const suits = Object.values(Suit)
  const ranks = Object.values(EuchreRank)

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
 * Deal cards evenly to players
 * Returns array of hands plus any remaining cards
 */
export function dealCards<T>(
  deck: T[],
  numPlayers: number,
  cardsPerPlayer: number
): { hands: T[][]; remaining: T[] } {
  const shuffled = shuffleDeck(deck)
  const hands: T[][] = []

  for (let i = 0; i < numPlayers; i++) {
    const start = i * cardsPerPlayer
    hands.push(shuffled.slice(start, start + cardsPerPlayer))
  }

  const remaining = shuffled.slice(numPlayers * cardsPerPlayer)
  return { hands, remaining }
}

/**
 * Deal all cards evenly (for President-style games)
 * Some players may get one extra card if deck doesn't divide evenly
 */
export function dealAllCards<T>(deck: T[], numPlayers: number): T[][] {
  const shuffled = shuffleDeck(deck)
  const hands: T[][] = Array.from({ length: numPlayers }, () => [])

  shuffled.forEach((card, index) => {
    hands[index % numPlayers]!.push(card)
  })

  return hands
}

/**
 * Get the suit of the same color (for bower determination in Euchre)
 */
export function getSameColorSuit(suit: Suit): Suit {
  switch (suit) {
    case Suit.Hearts:
      return Suit.Diamonds
    case Suit.Diamonds:
      return Suit.Hearts
    case Suit.Clubs:
      return Suit.Spades
    case Suit.Spades:
      return Suit.Clubs
  }
}
