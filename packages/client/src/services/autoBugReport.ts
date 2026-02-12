import { websocket } from './websocket'

const RATE_LIMIT_MS = 60_000 // 1 report per minute
let lastReportTime = 0

// Get API base URL (same origin in prod, or explicit for dev)
function getApiBaseUrl(): string {
  // In production, API is at same origin
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || ''
  }
  // In dev, default to local server
  return import.meta.env.VITE_API_URL || 'http://localhost:3001'
}

export async function sendBugReport(payload: Record<string, unknown>): Promise<void> {
  const now = Date.now()
  if (now - lastReportTime < RATE_LIMIT_MS) {
    console.log('[BugReport] Rate limited, skipping auto-report')
    return
  }
  lastReportTime = now

  // Try WebSocket first if connected
  if (websocket.isConnected) {
    try {
      websocket.send({
        type: 'bug_report',
        payload: JSON.stringify(payload),
      })
      console.log('[BugReport] Sent via WebSocket')
      return
    } catch (err) {
      console.warn('[BugReport] WebSocket send failed, trying HTTP:', err)
    }
  }

  // Fall back to HTTP
  try {
    const baseUrl = getApiBaseUrl()
    const res = await fetch(`${baseUrl}/api/bug-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await res.json()
    console.log('[BugReport] Sent via HTTP:', result)
  } catch (err) {
    console.error('[BugReport] HTTP send failed:', err)
  }
}
