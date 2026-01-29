// Klondike game initialization and state management

import { createStandardDeck, shuffleDeck } from '../core/deck.js'
import type { StandardCard } from '../core/types.js'
import type { KlondikeCard, KlondikeState, TableauColumn, FoundationPile } from './types.js'

/**
 * Convert a standard card to a Klondike card with face-up state
 */
function toKlondikeCard(card: StandardCard, faceUp: boolean): KlondikeCard {
  return { ...card, faceUp }
}

/**
 * Create a new shuffled Klondike game state
 */
export function createNewGame(): KlondikeState {
  // Create and shuffle deck
  const deck = shuffleDeck(createStandardDeck())

  // Deal tableau: 7 columns with 1,2,3,4,5,6,7 cards
  // Top card of each column is face-up, rest face-down
  const tableau: TableauColumn[] = []
  let cardIndex = 0

  for (let col = 0; col < 7; col++) {
    const numCards = col + 1
    const cards: KlondikeCard[] = []

    for (let i = 0; i < numCards; i++) {
      const card = deck[cardIndex++]!
      const isFaceUp = i === numCards - 1 // Only top card is face-up
      cards.push(toKlondikeCard(card, isFaceUp))
    }

    tableau.push({ cards })
  }

  // Remaining cards go to stock (face-down)
  const stock: KlondikeCard[] = deck
    .slice(cardIndex)
    .map((card) => toKlondikeCard(card, false))

  // Initialize empty foundations (one for each suit)
  const foundations: FoundationPile[] = [
    { suit: null, cards: [] },
    { suit: null, cards: [] },
    { suit: null, cards: [] },
    { suit: null, cards: [] },
  ]

  return {
    tableau,
    foundations,
    stock,
    waste: [],
    selection: null,
    moveCount: 0,
    isWon: false,
  }
}

/**
 * Check if the game is won (all 52 cards in foundations)
 */
export function checkWin(state: KlondikeState): boolean {
  const totalFoundationCards = state.foundations.reduce(
    (sum, f) => sum + f.cards.length,
    0
  )
  return totalFoundationCards === 52
}

/**
 * Create a deep copy of the game state
 */
export function cloneState(state: KlondikeState): KlondikeState {
  return {
    tableau: state.tableau.map((col) => ({
      cards: col.cards.map((c) => ({ ...c })),
    })),
    foundations: state.foundations.map((f) => ({
      suit: f.suit,
      cards: f.cards.map((c) => ({ ...c })),
    })),
    stock: state.stock.map((c) => ({ ...c })),
    waste: state.waste.map((c) => ({ ...c })),
    selection: state.selection ? { ...state.selection } : null,
    moveCount: state.moveCount,
    isWon: state.isWon,
  }
}
