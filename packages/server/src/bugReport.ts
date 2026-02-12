const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ''
const GITHUB_REPO = process.env.GITHUB_REPO ?? '' // e.g. "owner/euchre-app"
const RATE_LIMIT_MS = 60_000

const lastReportTime = new Map<string, number>()

export type ReportType = 'auto' | 'user'

export async function handleBugReport(
  clientId: string,
  payload: string
): Promise<{ success: boolean; issueUrl?: string }> {
  const now = Date.now()
  const last = lastReportTime.get(clientId) ?? 0
  if (now - last < RATE_LIMIT_MS) {
    console.log(`[BugReport] Rate limited for client ${clientId}`)
    return { success: false }
  }
  lastReportTime.set(clientId, now)

  // Clean up old entries periodically
  if (lastReportTime.size > 1000) {
    for (const [id, ts] of lastReportTime) {
      if (now - ts > RATE_LIMIT_MS * 10) lastReportTime.delete(id)
    }
  }

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.warn('[BugReport] GITHUB_TOKEN or GITHUB_REPO not set, skipping issue creation')
    console.log('[BugReport] Payload:', payload.slice(0, 500))
    return { success: false }
  }

  try {
    const diag = JSON.parse(payload) as Record<string, unknown>
    const reportType = (diag.reportType as ReportType) ?? 'auto'
    const title = formatIssueTitle(diag, reportType)
    const body = formatIssueBody(diag, reportType)
    const label = reportType === 'user' ? 'user-report' : 'auto-bug-report'

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title,
        body,
        labels: [label],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[BugReport] GitHub API error: ${res.status} ${res.statusText}`, text)
      return { success: false }
    }

    const data = (await res.json()) as { html_url: string }
    console.log(`[BugReport] Created issue: ${data.html_url}`)
    return { success: true, issueUrl: data.html_url }
  } catch (err) {
    console.error('[BugReport] Failed to create issue:', err)
    return { success: false }
  }
}

export function formatIssueTitle(diag: Record<string, unknown>, reportType: ReportType): string {
  const prefix = reportType === 'user' ? '[User]' : '[Auto]'
  const userDesc = diag.userDescription as string | undefined
  
  if (reportType === 'user' && userDesc) {
    // Use first line of user description as title
    const firstLine = userDesc.split('\n')[0].slice(0, 80)
    return `${prefix} ${firstLine}`
  }
  
  const error = (diag.serverError as string) ?? 'User report'
  const adapter = diag.adapter as Record<string, unknown> | undefined
  const phase = adapter?.phase ?? '?'
  return `${prefix} ${error} during ${phase}`
}

export function formatIssueBody(diag: Record<string, unknown>, reportType: ReportType): string {
  const adapter = diag.adapter as Record<string, unknown> | undefined
  const mp = diag.multiplayer as Record<string, unknown> | undefined
  const ws = diag.websocket as Record<string, unknown> | undefined

  const sections: string[] = []

  if (reportType === 'user') {
    sections.push('> User-submitted report from in-game bug button')
  } else {
    sections.push('> Auto-generated bug report from client')
  }
  sections.push('')

  // User description (for user reports)
  const userDesc = diag.userDescription as string | undefined
  if (userDesc) {
    sections.push('## User Description')
    sections.push(userDesc)
    sections.push('')
  }

  // Error info
  sections.push('## Error Info')
  sections.push(`- **Server error**: \`${diag.serverError ?? 'none'}\``)
  sections.push(`- **Error code**: \`${diag.serverErrorCode ?? 'none'}\``)
  sections.push(`- **Timestamp**: ${diag.createdAt ?? new Date().toISOString()}`)
  sections.push(`- **Trigger**: ${diag.trigger ?? 'unknown'}`)
  sections.push(`- **Report type**: ${reportType}`)
  sections.push('')

  // Game state
  if (adapter) {
    sections.push('## Game State')
    sections.push('| Field | Value |')
    sections.push('|-------|-------|')
    sections.push(`| Phase | \`${adapter.phase}\` |`)
    sections.push(`| Bidding Round | \`${adapter.biddingRound}\` |`)
    sections.push(`| Dealer | \`${adapter.dealer}\` |`)
    sections.push(`| Current Player | \`${adapter.currentPlayer}\` |`)
    sections.push(`| My Player ID | \`${adapter.myPlayerId}\` |`)
    sections.push(`| Is My Turn | \`${adapter.isMyTurn}\` |`)
    sections.push(`| Valid Actions | \`${JSON.stringify(adapter.validActions)}\` |`)
    sections.push(`| Valid Cards | \`${JSON.stringify(adapter.validCards)}\` |`)
    sections.push('')
  }

  // Multiplayer info
  if (mp) {
    sections.push('## Multiplayer')
    sections.push(`- **State Seq**: \`${mp.stateSeq}\``)
    sections.push(`- **Queue Length**: \`${mp.queueLength}\``)
    sections.push(`- **Timed Out Player**: \`${mp.timedOutPlayer}\``)
    sections.push('')
  }

  // Recent state summaries (last 5)
  const summaries = (mp?.recentStateSummaries ?? []) as unknown[]
  if (summaries.length > 0) {
    sections.push(`## Recent State Summaries (last 5 of ${summaries.length})`)
    sections.push('```json')
    sections.push(JSON.stringify(summaries.slice(-5), null, 2))
    sections.push('```')
    sections.push('')
  }

  // WS messages (last 10 inbound, last 5 outbound)
  if (ws) {
    const inbound = (ws.inbound ?? []) as unknown[]
    const outbound = (ws.outbound ?? []) as unknown[]

    if (inbound.length > 0) {
      sections.push(`## Recent Inbound WS (last 10 of ${inbound.length})`)
      sections.push('```json')
      sections.push(JSON.stringify(inbound.slice(-10), null, 2))
      sections.push('```')
      sections.push('')
    }

    if (outbound.length > 0) {
      sections.push(`## Recent Outbound WS (last 5 of ${outbound.length})`)
      sections.push('```json')
      sections.push(JSON.stringify(outbound.slice(-5), null, 2))
      sections.push('```')
      sections.push('')
    }
  }

  // Raw state (collapsed)
  if (diag.rawState) {
    sections.push('<details><summary>Full raw game state</summary>')
    sections.push('')
    sections.push('```json')
    sections.push(JSON.stringify(diag.rawState, null, 2))
    sections.push('```')
    sections.push('</details>')
  }

  return sections.join('\n')
}
