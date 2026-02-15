export interface ResyncStaleContext {
  staleThresholdMs: number
  timeSinceLastUpdate: number
  isWaitingForUs: boolean
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
  let intervalHandle: ReturnType<typeof setInterval> | null = null

  function now(): number {
    return Date.now()
  }

  return {
    markStateReceived() {
      lastStateReceivedAt = now()
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
          options.onStaleState({
            staleThresholdMs,
            timeSinceLastUpdate,
            isWaitingForUs,
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
    },
  }
}