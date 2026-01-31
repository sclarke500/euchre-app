// Klondike Solitaire types

import { Suit, FullRank } from '../core/types.js'
import type { StandardCard } from '../core/types.js'

// A card in Klondike with face-up/face-down state
export interface KlondikeCard extends StandardCard {
  faceUp: boolean
}

// A tableau column (one of the 7 columns)
export interface TableauColumn {
  cards: KlondikeCard[]
}

// A foundation pile (builds A→K of one suit)
export interface FoundationPile {
  suit: Suit | null  // null when empty
  cards: KlondikeCard[]
}

// Selection source types
export type SelectionSource = 'tableau' | 'waste'

// Selection state for tap-to-select, tap-to-move
export interface Selection {
  source: SelectionSource
  columnIndex?: number  // which tableau column (0-6), only for tableau
  cardIndex: number     // index of selected card within source
}

// Full game state for Klondike
export interface KlondikeState {
  tableau: TableauColumn[]      // 7 columns
  foundations: FoundationPile[] // 4 piles (one per suit)
  stock: KlondikeCard[]         // draw pile
  waste: KlondikeCard[]         // cards drawn from stock
  selection: Selection | null   // currently selected card(s)
  moveCount: number             // number of moves made
  isWon: boolean                // all cards in foundations
  drawCount: 1 | 3              // how many cards to draw at once (default 3)
}

// Move types for tracking
export type MoveType =
  | 'tableau-to-tableau'
  | 'tableau-to-foundation'
  | 'waste-to-tableau'
  | 'waste-to-foundation'
  | 'draw'
  | 'recycle'

// Move result
export interface MoveResult {
  success: boolean
  state: KlondikeState
  moveType?: MoveType
}

// Rank values for comparison (Ace=1, King=13)
export const RANK_VALUES: Record<FullRank, number> = {
  [FullRank.Ace]: 1,
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
}

// Red suits for alternating color checks
export const RED_SUITS: Set<Suit> = new Set([Suit.Hearts, Suit.Diamonds])
