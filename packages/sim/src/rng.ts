/**
 * Seeded PRNG (mulberry32). Returns values in [0, 1).
 * Same seed → same stream (reproducible deals + policy noise).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Derive a child seed from master + index (independent game streams). */
export function deriveSeed(master: number, index: number): number {
  // SplitMix64-ish mix into 32 bits
  let z = (master + index * 0x9e3779b9) >>> 0
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b)
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35)
  return (z ^ (z >>> 16)) >>> 0
}

/** Uniform pick from non-empty array. */
export function uniformPick<T>(items: T[], rng: () => number): T {
  if (items.length === 0) {
    throw new Error('uniformPick: empty array')
  }
  const i = Math.min(items.length - 1, Math.floor(rng() * items.length))
  return items[i]!
}
