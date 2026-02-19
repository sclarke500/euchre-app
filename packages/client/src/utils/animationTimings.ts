import { GameTimings } from '@67cards/shared'

// Base durations - abstract timing values
export const AnimationDurations = {
  fast: 220,
  medium: 350,
  slow: 520,
  slower: 700,
  pause: 900,
  longPause: 1200,
} as const

// Stagger/delay values
export const AnimationDelays = {
  dealStagger: 60,
  shortDelay: 120,
} as const

// Buffer values for settling/measuring
export const AnimationBuffers = {
  settle: 50,
  measure: 100,
} as const

// Semantic card animation timings - use these in game code
export const CardTimings = {
  // Card movements
  deal: AnimationDurations.fast,           // 220 - dealing cards from deck
  move: AnimationDurations.medium,         // 350 - playing a card
  flip: AnimationDurations.medium,         // 350 - flipping a card
  fan: AnimationDurations.medium,          // 350 - fanning out a hand
  sort: AnimationDurations.medium,         // 350 - sorting/reordering hand
  reveal: AnimationDurations.medium,       // 350 - revealing hidden cards
  collapse: AnimationDurations.fast,       // 220 - collapsing opponent hands
  
  // Trick-based games
  sweep: AnimationDurations.slow,          // 520 - sweeping trick to winner
  
  // President-specific
  exchange: AnimationDurations.pause,      // 900 - card exchange animation
  
  // AI/phase delays (uses shared GameTimings for server/client parity)
  aiThink: GameTimings.aiThinkMs,          // AI "thinking" delay
  phaseTransition: GameTimings.phasePauseMs, // between phases
  roundEnd: GameTimings.roundPauseMs,      // pause at end of round
  
  // Klondike-specific
  autoCompleteStep: 150,                   // delay between auto-complete moves
} as const

// Turn timer defaults
export const TimerDefaults = {
  gracePeriodMs: 2000,
  countdownMs: 30000,
  // Debug mode uses very long timers
  debugGracePeriodMs: 600000,
  debugCountdownMs: 600000,
} as const

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}