/**
 * Card Game Engine - Core Types
 * 
 * Clean, minimal types for a reusable card game engine.
 * No game-specific logic here - just the fundamentals.
 */

// ============================================================================
// CARD TYPES
// ============================================================================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'Joker'

export interface Card {
  id: string
  suit: Suit
  rank: Rank
  faceUp: boolean
}

// ============================================================================
// POSITION TYPES
// ============================================================================

/** 
 * Table positions - always relative to the viewing player (you = 'bottom')
 * This makes layouts consistent regardless of actual seat assignments.
 */
export type TablePosition = 'bottom' | 'left' | 'top' | 'right' | 'top-left' | 'top-right'

/**
 * Where a card can exist on the table
 */
export type CardLocation = 
  | { zone: 'deck' }
  | { zone: 'hand'; position: TablePosition }
  | { zone: 'play-area'; position: TablePosition }  // card played to center
  | { zone: 'kitty' }                                // center pile (trump card, discard, etc)
  | { zone: 'discard' }                             // off-table discard pile
  | { zone: 'won-tricks'; position: TablePosition } // tricks won by player

// ============================================================================
// PLAYER TYPES
// ============================================================================

export interface Player {
  id: string
  name: string
  position: TablePosition
  isHuman: boolean
  isCurrentTurn: boolean
}

// ============================================================================
// TABLE LAYOUT
// ============================================================================

/**
 * Defines how many players and where they sit.
 * The engine uses this to set up the grid.
 */
export interface TableLayout {
  playerCount: 2 | 3 | 4 | 5 | 6
  positions: TablePosition[]
}

export const LAYOUTS: Record<number, TableLayout> = {
  2: { playerCount: 2, positions: ['bottom', 'top'] },
  3: { playerCount: 3, positions: ['bottom', 'left', 'right'] },
  4: { playerCount: 4, positions: ['bottom', 'left', 'top', 'right'] },
  5: { playerCount: 5, positions: ['bottom', 'left', 'top-left', 'top-right', 'right'] },
  6: { playerCount: 6, positions: ['bottom', 'left', 'top-left', 'top', 'top-right', 'right'] },
}

// ============================================================================
// ANIMATION TYPES
// ============================================================================

export type AnimationType = 
  | 'deal'           // deck → hand
  | 'play'           // hand → play-area
  | 'collect'        // play-area → won-tricks (sweep)
  | 'flip'           // face-down ↔ face-up
  | 'sort'           // rearrange within hand
  | 'discard'        // hand → discard pile

export interface AnimationRequest {
  type: AnimationType
  cardId: string
  from: CardLocation
  to: CardLocation
  duration?: number  // ms, default based on type
  delay?: number     // ms, for staggered animations
}

// ============================================================================
// TABLE STATE
// ============================================================================

/**
 * Complete state of the table at any moment.
 * Animations are computed from state transitions.
 */
export interface TableState {
  cards: Map<string, Card>
  cardLocations: Map<string, CardLocation>
  players: Player[]
  layout: TableLayout
}
