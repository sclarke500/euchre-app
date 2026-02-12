import { websocket } from './websocket'

const RATE_LIMIT_MS = 60_000 // 1 report per minute
let lastReportTime = 0

export function sendBugReport(payload: Record<string, unknown>): void {
  const now = Date.now()
  if (now - lastReportTime < RATE_LIMIT_MS) {
    console.log('[BugReport] Rate limited, skipping auto-report')
    return
  }
  lastReportTime = now

  try {
    websocket.send({
      type: 'bug_report',
      payload: JSON.stringify(payload),
    })
    console.log('[BugReport] Sent auto bug report')
  } catch (err) {
    console.error('[BugReport] Failed to send:', err)
  }
}
