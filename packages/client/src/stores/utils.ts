/**
 * Shared utilities for store reactivity management
 */

/**
 * Only update a ref if the array content actually changed.
 * Avoids triggering downstream reactivity from messages with identical data.
 */
export function updateIfChanged(target: { value: string[] }, incoming: string[]): void {
  if (target.value.length !== incoming.length ||
      target.value.some((v, i) => v !== incoming[i])) {
    target.value = incoming
  }
}
