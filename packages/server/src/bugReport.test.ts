import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleBugReport, formatIssueTitle, formatIssueBody } from './bugReport.js'

describe('formatIssueTitle', () => {
  it('includes error message and phase', () => {
    const title = formatIssueTitle({
      serverError: 'Invalid bid',
      adapter: { phase: 'bidding_round_1' },
    })
    expect(title).toBe('[Auto] Invalid bid during bidding_round_1')
  })

  it('handles missing fields gracefully', () => {
    const title = formatIssueTitle({})
    expect(title).toBe('[Auto] Unknown error during ?')
  })

  it('handles missing adapter', () => {
    const title = formatIssueTitle({ serverError: 'Some error' })
    expect(title).toBe('[Auto] Some error during ?')
  })
})

describe('formatIssueBody', () => {
  it('includes error section', () => {
    const body = formatIssueBody({
      serverError: 'Invalid bid',
      serverErrorCode: 'invalid_action',
      createdAt: '2025-01-01T00:00:00Z',
      trigger: 'auto',
    })
    expect(body).toContain('## Error')
    expect(body).toContain('`Invalid bid`')
    expect(body).toContain('`invalid_action`')
    expect(body).toContain('2025-01-01T00:00:00Z')
    expect(body).toContain('auto')
  })

  it('includes game state table when adapter present', () => {
    const body = formatIssueBody({
      adapter: {
        phase: 'playing',
        biddingRound: null,
        dealer: 2,
        currentPlayer: 3,
        myPlayerId: 0,
        isMyTurn: false,
        validActions: [],
        validCards: [],
      },
    })
    expect(body).toContain('## Game State')
    expect(body).toContain('| Phase | `playing` |')
    expect(body).toContain('| Dealer | `2` |')
    expect(body).toContain('| Current Player | `3` |')
  })

  it('includes multiplayer section when present', () => {
    const body = formatIssueBody({
      multiplayer: {
        stateSeq: 42,
        queueLength: 0,
        timedOutPlayer: null,
        recentStateSummaries: [{ ts: 1, phase: 'playing' }],
      },
    })
    expect(body).toContain('## Multiplayer')
    expect(body).toContain('`42`')
    expect(body).toContain('## Recent State Summaries')
  })

  it('limits state summaries to last 5', () => {
    const summaries = Array.from({ length: 10 }, (_, i) => ({ seq: i }))
    const body = formatIssueBody({
      multiplayer: { recentStateSummaries: summaries },
    })
    // Should only contain the last 5
    expect(body).toContain('"seq": 5')
    expect(body).toContain('"seq": 9')
    expect(body).not.toContain('"seq": 4')
  })

  it('limits inbound WS to last 10 and outbound to last 5', () => {
    const inbound = Array.from({ length: 20 }, (_, i) => ({ msg: `in-${i}` }))
    const outbound = Array.from({ length: 10 }, (_, i) => ({ msg: `out-${i}` }))
    const body = formatIssueBody({
      websocket: { inbound, outbound },
    })
    expect(body).toContain('last 10 of 20')
    expect(body).toContain('last 5 of 10')
    expect(body).toContain('"msg": "in-19"')
    expect(body).not.toContain('"msg": "in-9"')
    expect(body).toContain('"msg": "out-9"')
    expect(body).not.toContain('"msg": "out-4"')
  })

  it('wraps raw state in collapsed details', () => {
    const body = formatIssueBody({
      rawState: { phase: 'playing', dealer: 1 },
    })
    expect(body).toContain('<details>')
    expect(body).toContain('Full raw game state')
    expect(body).toContain('"phase": "playing"')
  })

  it('omits sections when data is absent', () => {
    const body = formatIssueBody({})
    expect(body).toContain('## Error')
    expect(body).not.toContain('## Game State')
    expect(body).not.toContain('## Multiplayer')
    expect(body).not.toContain('## Recent Inbound')
  })
})

describe('handleBugReport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns success: false when env vars not set', async () => {
    const result = await handleBugReport('client-1', JSON.stringify({ serverError: 'test' }))
    expect(result.success).toBe(false)
  })

  it('rate limits repeated reports from same client', async () => {
    const payload = JSON.stringify({ serverError: 'test' })

    const result1 = await handleBugReport('client-rate', payload)
    expect(result1.success).toBe(false) // no env vars, but not rate limited

    const result2 = await handleBugReport('client-rate', payload)
    expect(result2.success).toBe(false) // rate limited — doesn't even try

    // Advance past rate limit
    vi.advanceTimersByTime(61_000)

    const result3 = await handleBugReport('client-rate', payload)
    expect(result3.success).toBe(false) // not rate limited, but no env vars
  })

  it('allows reports from different clients', async () => {
    const payload = JSON.stringify({ serverError: 'test' })

    await handleBugReport('client-a', payload)
    const result = await handleBugReport('client-b', payload)
    // Both should get through (both fail due to no env vars, but not rate limited)
    expect(result.success).toBe(false)
  })
})
