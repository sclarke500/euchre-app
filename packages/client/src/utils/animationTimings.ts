export const AnimationDurations = {
  fast: 220,
  medium: 350,
  slow: 520,
  slower: 700,
  pause: 900,
  longPause: 1200,
} as const

export const AnimationDelays = {
  dealStagger: 60,
  shortDelay: 120,
} as const

export const AnimationBuffers = {
  settle: 50,
} as const

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}