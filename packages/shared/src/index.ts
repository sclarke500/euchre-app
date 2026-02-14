// Re-export all types and game logic

// Euchre game (original game - keep all exports for backward compatibility)
export * from './game.js'
export * from './multiplayer.js'
export * from './deck.js'
export * from './trick.js'
export * from './scoring.js'
export * from './trump.js'
export * from './ai.js'
export * from './ai-hard.js'
export * from './aiNames.js'

// Core types - export new types that don't conflict with Euchre
// Note: GameType is intentionally not re-exported from core/types as multiplayer.ts has its own GameType
export { FullRank, EuchreRank } from './core/types.js'
export type { StandardCard, EuchreCard, BasePlayer } from './core/types.js'
export { createStandardDeck, createEuchreDeck, createPresidentDeck, dealAllCards } from './core/deck.js'

// President game (new)
export * from './president/index.js'

// Klondike Solitaire
export * from './klondike/index.js'

// Spades game - namespaced to avoid conflicts
export * as Spades from './spades/index.js'
// Also export types directly (they don't conflict)
export {
  SpadesPhase,
  SpadesBidType,
  SpadesAction,
  type SpadesGameState,
  type SpadesPlayer,
  type SpadesBid,
  type SpadesTrick,
  type SpadesTeamScore,
  type SpadesRoundScore,
  type SpadesClientGameState,
  type SpadesClientPlayer,
  type SpadesTeamRoundState,
  type SpadesPlayerAction,
} from './spades/index.js'
