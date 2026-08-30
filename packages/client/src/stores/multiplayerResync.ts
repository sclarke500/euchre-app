export interface ResyncStaleContext {
  staleThresholdMs: number
  timeSinceLastUpdate: number
  isWaitingForUs: boolean
  /**
   * How many stale checks have fired in a row without any state arriving in
   * between. 1 on the first fire; 2+ means an earlier recovery attempt (e.g. a
   * resync request) went unanswered — likely a zombie socket that reports OPEN
   * but delivers nothing, so callers should escalate to a forced reconnect.
   */
  consecutiveStaleFires: number
}

export interface MultiplayerResyncWatchdog {
  markStateReceived: () => void
  start: () => void
  stop: () => void
  reset: () => void
}

interface MultiplayerResyncWatchdogOptions {
  isGameActive: () => boolean
  isWaitingForUs: () => boolean
  onStaleState: (ctx: ResyncStaleContext) => void
  checkIntervalMs?: number
  waitingThresholdMs?: number
  idleThresholdMs?: number
}

export function createMultiplayerResyncWatchdog(
  options: MultiplayerResyncWatchdogOptions
): MultiplayerResyncWatchdog {
  const checkIntervalMs = options.checkIntervalMs ?? 5000
  const waitingThresholdMs = options.waitingThresholdMs ?? 10000
  const idleThresholdMs = options.idleThresholdMs ?? 30000

  let lastStateReceivedAt = 0
  let consecutiveStaleFires = 0
  let intervalHandle: ReturnType<typeof setInterval> | null = null

  function now(): number {
    return Date.now()
  }

  return {
    markStateReceived() {
      lastStateReceivedAt = now()
      consecutiveStaleFires = 0
    },

    start() {
      if (intervalHandle) return

      if (lastStateReceivedAt === 0) {
        lastStateReceivedAt = now()
      }

      intervalHandle = setInterval(() => {
        if (!options.isGameActive()) return

        const isWaitingForUs = options.isWaitingForUs()
        const staleThresholdMs = isWaitingForUs ? waitingThresholdMs : idleThresholdMs
        const timeSinceLastUpdate = now() - lastStateReceivedAt

        if (timeSinceLastUpdate > staleThresholdMs) {
          consecutiveStaleFires++
          options.onStaleState({
            staleThresholdMs,
            timeSinceLastUpdate,
            isWaitingForUs,
            consecutiveStaleFires,
          })
          lastStateReceivedAt = now()
        }
      }, checkIntervalMs)
    },

    stop() {
      if (!intervalHandle) return
      clearInterval(intervalHandle)
      intervalHandle = null
    },

    reset() {
      lastStateReceivedAt = 0
      consecutiveStaleFires = 0
    },
  }
}