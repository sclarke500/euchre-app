// Re-export all types and game logic

// Utilities
export { createGameTimer, type GameTimer, GameTimings } from './utils/timer.js'

// AI Personality
export { getAIComment, resetAIChatCooldown, type AIChatEvent } from './ai/personality.js'

// Multiplayer protocol and table/lobby types
export * from './multiplayer/index.js'

// Euchre game
export * from './euchre/index.js'

// Core types - export new types that don't conflict with Euchre
// Note: GameType is intentionally not re-exported from core/types as multiplayer.ts has its own GameType
export { FullRank, EuchreRank } from './core/types.js'
export type { StandardCard, EuchreCard, BasePlayer } from './core/types.js'
export { createStandardDeck, createEuchreDeck, createPresidentDeck, dealAllCards } from './core/deck.js'
export { AI_NAMES, AI_AVATARS, getAIAvatar, getRandomAIName, getRandomAINames, type AIName } from './core/aiNames.js'

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
  SpadesTracker,
  chooseSpadesCardHard,
  chooseSpadesBidHard,
} from './spades/index.js'
