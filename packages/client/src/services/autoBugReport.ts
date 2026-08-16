import { Capacitor } from '@capacitor/core'
import { websocket } from './websocket'

const RATE_LIMIT_MS = 60_000 // 1 report per minute
let lastReportTime = 0

// Web: relative URL — Vite (dev) and Netlify (prod) both proxy /api to backend.
// Native: the WebView origin is capacitor://localhost (iOS) / https://localhost
// (Android), so a relative fetch never leaves the device — derive the real
// server origin from the WS URL instead (wss://host → https://host).
function getApiBaseUrl(): string {
  if (!Capacitor.isNativePlatform()) return ''
  const wsUrl = import.meta.env.VITE_WS_URL
  if (!wsUrl) return ''
  return wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')
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
