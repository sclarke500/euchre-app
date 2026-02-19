/**
 * Cancellable game timer
 * 
 * Platform-agnostic timer utility for scheduling delayed actions that:
 * - Can be cancelled (user leaves, game restarts)
 * - Can be paused/resumed (e.g., bug report modal)
 * - Support multiple named timers
 * 
 * Usage:
 *   const timer = createGameTimer()
 *   timer.schedule('ai-turn', 1500, () => processAITurn())
 *   timer.cancel('ai-turn')  // or timer.cancelAll()
 * 
 * Single timer shorthand:
 *   timer.after(1500, () => doSomething())
 *   timer.cancel()  // cancels '_default'
 */

interface ScheduledTimer {
  id: ReturnType<typeof setTimeout>
  callback: () => void
  remaining: number
  startedAt: number
  paused: boolean
}

export interface GameTimer {
  /** Schedule a named timer */
  schedule: (name: string, delayMs: number, callback: () => void) => void
  /** Cancel a named timer (defaults to '_default') */
  cancel: (name?: string) => void
  /** Cancel all timers */
  cancelAll: () => void
  /** Pause all timers */
  pauseAll: () => void
  /** Resume all paused timers */
  resumeAll: () => void
  /** Check if a timer is active */
  isActive: (name?: string) => boolean
  /** Check if any timer is paused */
  isPaused: () => boolean
  /** Shorthand: schedule a single unnamed timer */
  after: (delayMs: number, callback: () => void) => void
}

export function createGameTimer(): GameTimer {
  const timers = new Map<string, ScheduledTimer>()
  let paused = false

  function schedule(name: string, delayMs: number, callback: () => void) {
    // Cancel existing timer with same name
    cancel(name)

    const timer: ScheduledTimer = {
      id: setTimeout(() => {
        timers.delete(name)
        callback()
      }, delayMs),
      callback,
      remaining: delayMs,
      startedAt: Date.now(),
      paused: false,
    }

    timers.set(name, timer)
  }

  function cancel(name: string = '_default') {
    const timer = timers.get(name)
    if (timer) {
      clearTimeout(timer.id)
      timers.delete(name)
    }
  }

  function cancelAll() {
    for (const timer of timers.values()) {
      clearTimeout(timer.id)
    }
    timers.clear()
  }

  function pauseAll() {
    if (paused) return
    paused = true

    for (const timer of timers.values()) {
      if (!timer.paused) {
        clearTimeout(timer.id)
        timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
        timer.paused = true
      }
    }
  }

  function resumeAll() {
    if (!paused) return
    paused = false

    for (const [name, timer] of timers) {
      if (timer.paused && timer.remaining > 0) {
        timer.startedAt = Date.now()
        timer.paused = false
        timer.id = setTimeout(() => {
          timers.delete(name)
          timer.callback()
        }, timer.remaining)
      }
    }
  }

  function isActive(name: string = '_default'): boolean {
    return timers.has(name)
  }

  function isPaused(): boolean {
    return paused
  }

  function after(delayMs: number, callback: () => void) {
    schedule('_default', delayMs, callback)
  }

  return {
    schedule,
    cancel,
    cancelAll,
    pauseAll,
    resumeAll,
    isActive,
    isPaused,
    after,
  }
}
