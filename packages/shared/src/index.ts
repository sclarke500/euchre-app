// Re-export all types and game logic

// Euchre game (original game - keep all exports for backward compatibility)
export * from './game.js'
export * from './multiplayer.js'
export * from './deck.js'
export * from './trick.js'
export * from './scoring.js'
export * from './trump.js'
export * from './ai.js'
export * from './aiNames.js'

// Core types - export new types that don't conflict with Euchre
export { FullRank, EuchreRank } from './core/types.js'
export type { StandardCard, EuchreCard, BasePlayer, GameType } from './core/types.js'
export { createStandardDeck, createEuchreDeck, dealAllCards } from './core/deck.js'

// President game (new)
export * from './president/index.js'

// Klondike Solitaire
export * from './klondike/index.js'
