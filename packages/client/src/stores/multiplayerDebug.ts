export interface MultiplayerDebugSnapshot {
  ts: number
  store: string
  phase: string
  stateSeq: number
  currentPlayer: number | null
  myPlayerId: number | null
  isMyTurn: boolean
  queueMode: boolean
  queueLength: number
  validActionsCount: number
  validCardsCount?: number
  validPlaysCount?: number
  gameLost: boolean
  timedOutPlayer: number | null
}

let debugEnabledCache: boolean | null = null

function isMultiplayerDebugEnabled(): boolean {
  if (debugEnabledCache !== null) {
    return debugEnabledCache
  }

  try {
    const queryEnabled = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('mpDebug') === '1'
    const storageEnabled = typeof window !== 'undefined'
      && window.localStorage.getItem('mpDebug') === '1'
    debugEnabledCache = queryEnabled || storageEnabled
    return debugEnabledCache
  } catch {
    debugEnabledCache = false
    return debugEnabledCache
  }
}

export function buildMultiplayerDebugSnapshot(
  snapshot: Omit<MultiplayerDebugSnapshot, 'ts'>
): MultiplayerDebugSnapshot {
  return {
    ts: Date.now(),
    ...snapshot,
  }
}

export function logMultiplayerEvent(
  store: string,
  event: string,
  snapshot: MultiplayerDebugSnapshot,
  extra?: Record<string, unknown>
): void {
  if (!isMultiplayerDebugEnabled()) {
    return
  }

  console.info(`[MP:${store}] ${event}`, {
    event,
    ...snapshot,
    ...(extra ?? {}),
  })
}
