/**
 * Bot Profile Types
 */

export type RemarkMode = 'mild' | 'spicy'
export type Sentiment = 'positive' | 'negative'

/**
 * Game-agnostic remark categories. Game events map to one of these, and bots
 * author lines per category so every bot reacts in its own voice.
 *
 * - brag_big:  I did something spectacular (alone march, nil made)
 * - brag:      I did what I said I'd do (made my call/bid, went out first)
 * - gloat:     You failed and I love it (euchred you, set you, broke your nil)
 * - wince_big: I failed spectacularly (euchred going alone, nil broken)
 * - wince:     I came up short (got euchred, got set, went scum)
 * - celebrate: Game won (falls back to legacy positive pool if unauthored)
 * - concede:   Game lost (falls back to legacy negative pool if unauthored)
 * - ominous:   Tension builder (team at game point)
 */
export type RemarkCategory =
  | 'brag_big'
  | 'brag'
  | 'gloat'
  | 'wince_big'
  | 'wince'
  | 'celebrate'
  | 'concede'
  | 'ominous'

export interface RemarkPool {
  mild: string[]
  spicy: string[]
}

export interface BotRemarks {
  positive: RemarkPool
  negative: RemarkPool
}

export interface BotProfile {
  name: string
  avatar: string  // filename in /avatars/ai/
  /** Legacy sentiment pools — final fallback, also used for celebrate/concede */
  remarks: BotRemarks
  /** Per-category pools in this bot's voice */
  categories?: Partial<Record<RemarkCategory, RemarkPool>>
  /** Per-event overrides for extra-specific flavor (keyed by event type, e.g. 'alone_march') */
  events?: Record<string, RemarkPool>
}
