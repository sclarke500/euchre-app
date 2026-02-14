/**
 * Shared utilities for store reactivity management
 */

import type { Ref } from 'vue'

/**
 * Only update a ref if the value actually changed.
 * Avoids triggering downstream reactivity from messages with identical data.
 */

// Primitive overload (boolean, number, string)
export function updateIfChanged<T extends boolean | number | string>(
  target: Ref<T>,
  incoming: T
): void

// String array overload
export function updateIfChanged(
  target: Ref<string[]>,
  incoming: string[]
): void

// String[][] overload (for validPlays)
export function updateIfChanged(
  target: Ref<string[][]>,
  incoming: string[][]
): void

// Implementation
export function updateIfChanged<T>(
  target: Ref<T>,
  incoming: T
): void {
  // Primitive types - direct comparison
  if (typeof incoming === 'boolean' || typeof incoming === 'number' || typeof incoming === 'string') {
    if (target.value !== incoming) {
      target.value = incoming
    }
    return
  }

  // Array types
  if (Array.isArray(incoming)) {
    const current = target.value as unknown[]
    
    // Different lengths = definitely changed
    if (!Array.isArray(current) || current.length !== incoming.length) {
      target.value = incoming
      return
    }

    // Check if it's a nested array (string[][])
    if (incoming.length > 0 && Array.isArray(incoming[0])) {
      // Compare string[][] - each element is a string[]
      const currentNested = current as string[][]
      const incomingNested = incoming as string[][]
      
      const changed = currentNested.some((arr, i) => {
        const inArr = incomingNested[i]
        if (!inArr) return true
        return arr.length !== inArr.length || arr.some((v, j) => v !== inArr[j])
      })
      
      if (changed) {
        target.value = incoming
      }
      return
    }

    // Flat array - compare elements
    if (current.some((v, i) => v !== incoming[i])) {
      target.value = incoming
    }
    return
  }

  // Fallback for other types - always update
  target.value = incoming
}
