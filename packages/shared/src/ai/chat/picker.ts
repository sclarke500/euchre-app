/**
 * Chat Phrase Picker
 * 
 * Core logic for selecting chat phrases based on triggers and mode.
 */

import type { ChatTrigger, ChatMode, PhrasePool, WeightedPhrase, TriggerConfig } from './types.js'

// Cooldown tracking (prevents spam)
let lastChatTime = 0
const DEFAULT_COOLDOWN_MS = 500  // TESTING: reduced from 3000

// Trigger configuration - probability and priority
// TESTING: All chances set to 1.0 for quick testing
const triggerConfig: Partial<Record<ChatTrigger, TriggerConfig>> = {
  // Euchre triggers
  euchred_opponent: { chance: 1.0, priority: 80 },
  got_euchred: { chance: 1.0, priority: 75 },
  won_trick_bower: { chance: 1.0, priority: 30 },
  won_trick_big: { chance: 1.0, priority: 20 },
  partner_clutch: { chance: 1.0, priority: 40 },
  partner_saved_caller: { chance: 1.0, priority: 90 },
  called_trump_made: { chance: 1.0, priority: 50 },
  called_trump_euchred: { chance: 1.0, priority: 85 },
  alone_success: { chance: 1.0, priority: 88 },
  alone_march: { chance: 1.0, priority: 95 },
  alone_failed: { chance: 1.0, priority: 82 },
  stole_deal: { chance: 1.0, priority: 45 },
  
  // Generic triggers
  game_won: { chance: 1.0, priority: 70 },
  game_lost: { chance: 1.0, priority: 65 },
  round_won: { chance: 1.0, priority: 35 },
  round_lost: { chance: 1.0, priority: 30 },
  
  // President triggers (TESTING: 1.0)
  president_first_out: { chance: 1.0, priority: 90 },
  president_second_out: { chance: 1.0, priority: 50 },
  president_last_out: { chance: 1.0, priority: 85 },
  president_pile_cleared: { chance: 1.0, priority: 60 },
  
  // Spades triggers (TESTING: 1.0)
  spades_nil_made: { chance: 1.0, priority: 85 },
  spades_nil_failed: { chance: 1.0, priority: 88 },
  spades_blind_nil_made: { chance: 1.0, priority: 95 },
  spades_blind_nil_failed: { chance: 1.0, priority: 92 },
  spades_opponent_nil_failed: { chance: 1.0, priority: 75 },
  spades_got_set: { chance: 1.0, priority: 80 },
  spades_set_opponent: { chance: 1.0, priority: 78 },
}

/**
 * Get config for a trigger, with defaults
 */
export function getTriggerConfig(trigger: ChatTrigger): TriggerConfig {
  return triggerConfig[trigger] ?? { chance: 0.25, priority: 10 }
}

/**
 * Pick a weighted random phrase from a pool
 */
export function pickWeighted(pool: PhrasePool): string | null {
  if (!pool || pool.length === 0) return null
  
  const totalWeight = pool.reduce((sum, p) => sum + (p.weight ?? 1), 0)
  let random = Math.random() * totalWeight
  
  for (const phrase of pool) {
    random -= phrase.weight ?? 1
    if (random <= 0) {
      return phrase.text
    }
  }
  
  return pool[pool.length - 1]?.text ?? null
}

/**
 * Check if we should chat based on trigger probability and cooldown
 */
export function shouldChat(trigger: ChatTrigger, forceTrigger = false): boolean {
  const now = Date.now()
  const config = getTriggerConfig(trigger)
  
  // Cooldown check (unless forcing)
  const cooldown = config.cooldownMs ?? DEFAULT_COOLDOWN_MS
  if (!forceTrigger && now - lastChatTime < cooldown) {
    return false
  }
  
  // Probability check (unless forcing)
  if (!forceTrigger && Math.random() > config.chance) {
    return false
  }
  
  return true
}

/**
 * Record that a chat was sent (for cooldown tracking)
 */
export function recordChat(): void {
  lastChatTime = Date.now()
}

/**
 * Reset cooldown (for testing or game restart)
 */
export function resetChatCooldown(): void {
  lastChatTime = 0
}

/**
 * Sort triggers by priority (highest first)
 */
export function sortByPriority(triggers: ChatTrigger[]): ChatTrigger[] {
  return [...triggers].sort((a, b) => {
    const configA = getTriggerConfig(a)
    const configB = getTriggerConfig(b)
    return configB.priority - configA.priority
  })
}
