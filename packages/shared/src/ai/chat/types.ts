/**
 * Chat System Types
 * 
 * Shared types for the bot chat system across all games.
 */

// Generic chat triggers that could apply to any trick-taking game
export type GenericChatTrigger =
  | 'won_trick_big'      // Won a trick decisively
  | 'partner_clutch'     // Partner made a great play
  | 'round_won'          // Won the round
  | 'round_lost'         // Lost the round
  | 'game_won'           // Won the game
  | 'game_lost'          // Lost the game

// Euchre-specific triggers
export type EuchreChatTrigger =
  | 'euchred_opponent'      // We euchred them
  | 'got_euchred'           // They euchred us
  | 'won_trick_bower'       // Won trick with right or left bower
  | 'partner_saved_caller'  // Partner saved caller who made 0 tricks
  | 'called_trump_made'     // Called trump and made it
  | 'called_trump_euchred'  // Called trump and got euchred (self-blame)
  | 'alone_success'         // Went alone and made it
  | 'alone_march'           // Went alone and got all 5 (rare!)
  | 'alone_failed'          // Went alone and failed
  | 'stole_deal'            // Ordered up / called when opponents dealt

// All chat triggers (union of generic + game-specific)
export type ChatTrigger = GenericChatTrigger | EuchreChatTrigger

// Chat mode (maps to user setting)
export type ChatMode = 'clean' | 'unhinged'

// A chat event ready to display
export interface ChatEvent {
  odusId: string        // Bot's ID (e.g., 'ai-1')
  seatIndex: number     // Bot's seat
  playerName: string    // Bot's display name
  text: string          // The chat message
  trigger: ChatTrigger  // What triggered this (for debugging/analytics)
}

// Phrase with optional weight (higher = more common)
export interface WeightedPhrase {
  text: string
  weight?: number  // default 1
}

export type PhrasePool = WeightedPhrase[]

// Trigger config - probability and priority
export interface TriggerConfig {
  chance: number      // 0-1, probability of triggering chat
  priority: number    // Higher = more important (used when multiple triggers)
  cooldownMs?: number // Optional cooldown for this specific trigger
}
