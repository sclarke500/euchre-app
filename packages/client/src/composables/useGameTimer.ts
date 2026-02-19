/**
 * Vue composable wrapper for GameTimer
 * 
 * Wraps the shared createGameTimer() with Vue lifecycle hooks
 * for automatic cleanup on component unmount.
 * 
 * Usage in components:
 *   const timer = useGameTimer()
 *   timer.schedule('ai-turn', 1500, () => processAITurn())
 *   // Auto-cancelled on unmount
 * 
 * For stores (no auto-cleanup):
 *   import { createGameTimer } from '@67cards/shared'
 *   const timer = createGameTimer()
 *   // Must call timer.cancelAll() manually
 */

import { onUnmounted, ref, readonly } from 'vue'
import { createGameTimer, type GameTimer } from '@67cards/shared'

export interface VueGameTimer extends GameTimer {
  /** Reactive paused state for template binding */
  isPausedRef: Readonly<ReturnType<typeof ref<boolean>>>
}

export function useGameTimer(): VueGameTimer {
  const timer = createGameTimer()
  const isPausedRef = ref(false)

  // Wrap pauseAll/resumeAll to sync reactive state
  const originalPauseAll = timer.pauseAll
  const originalResumeAll = timer.resumeAll

  timer.pauseAll = () => {
    originalPauseAll()
    isPausedRef.value = true
  }

  timer.resumeAll = () => {
    originalResumeAll()
    isPausedRef.value = false
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    timer.cancelAll()
  })

  return {
    ...timer,
    isPausedRef: readonly(isPausedRef),
  }
}

// Re-export for convenience
export { createGameTimer, type GameTimer } from '@67cards/shared'
