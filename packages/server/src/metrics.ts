/**
 * Simple in-memory metrics for monitoring sync issues.
 * Resets on server restart (ephemeral).
 */

interface SyncRequiredEvent {
  timestamp: number
  gameId: string | null
  gameType: string | null
  playerId: string | null
  expectedSeq: number
  actualSeq: number
}

interface Metrics {
  syncRequiredCount: number
  syncRequiredLast10: SyncRequiredEvent[]
  serverStartedAt: number
}

const metrics: Metrics = {
  syncRequiredCount: 0,
  syncRequiredLast10: [],
  serverStartedAt: Date.now(),
}

export function recordSyncRequired(event: Omit<SyncRequiredEvent, 'timestamp'>): void {
  metrics.syncRequiredCount++
  
  const fullEvent: SyncRequiredEvent = {
    ...event,
    timestamp: Date.now(),
  }
  
  // Keep last 10 events for debugging
  metrics.syncRequiredLast10.push(fullEvent)
  if (metrics.syncRequiredLast10.length > 10) {
    metrics.syncRequiredLast10.shift()
  }
  
  // Structured log for Render search
  console.log('[SYNC_REQUIRED]', JSON.stringify(fullEvent))
}

export function getMetrics(): Metrics & { uptimeMs: number } {
  return {
    ...metrics,
    uptimeMs: Date.now() - metrics.serverStartedAt,
  }
}
