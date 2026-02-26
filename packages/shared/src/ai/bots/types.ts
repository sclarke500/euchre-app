/**
 * Bot Profile Types
 */

export type RemarkMode = 'mild' | 'spicy'
export type Sentiment = 'positive' | 'negative'

export interface BotRemarks {
  positive: {
    mild: string[]
    spicy: string[]
  }
  negative: {
    mild: string[]
    spicy: string[]
  }
}

export interface BotProfile {
  name: string
  avatar: string  // filename in /avatars/ai/
  remarks: BotRemarks
}
