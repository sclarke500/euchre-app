import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BidAction, GamePhase, GameTimings } from '@67cards/shared'
import { EuchreGame } from './EuchreGame.js'

/**
 * Phase 0.5 hotfix: R2 all-pass must redeal (not spin forever).
 * Server has no stick-the-dealer setting yet — unconditional redeal.
 */
describe('EuchreGame R2 all-pass redeal', () => {
  let game: EuchreGame

  beforeEach(() => {
    vi.useFakeTimers()
    game = new EuchreGame('test-r2-redeal', {
      onStateChange: vi.fn() as any,
      onBidMade: vi.fn() as any,
      onCardPlayed: vi.fn() as any,
      onTrickComplete: vi.fn() as any,
      onRoundComplete: vi.fn() as any,
      onGameOver: vi.fn() as any,
      onYourTurn: vi.fn() as any,
      onTurnReminder: vi.fn() as any,
      onPlayerTimedOut: vi.fn() as any,
      onPlayerBooted: vi.fn() as any,
      onPlayerDisconnected: vi.fn() as any,
      onPlayerReconnected: vi.fn() as any,
    })

    // All humans so AI never steals a bid and forces trump
    game.initializePlayers([
      { odusId: 'p0', name: 'P0', seatIndex: 0 },
      { odusId: 'p1', name: 'P1', seatIndex: 1 },
      { odusId: 'p2', name: 'P2', seatIndex: 2 },
      { odusId: 'p3', name: 'P3', seatIndex: 3 },
    ])
    game.start()
    // Deal animation → BiddingRound1
    vi.advanceTimersByTime(GameTimings.phasePauseMs)
  })

  afterEach(() => {
    game.cleanup?.()
    vi.useRealTimers()
  })

  function passCurrent(): void {
    const seat = game['currentRound']!.currentPlayer
    const odusId = game['players'][seat]!.odusId!
    const ok = game.handleBid(odusId, BidAction.Pass)
    expect(ok).toBe(true)
  }

  it('redeals and rotates dealer after four passes in bidding round 2', () => {
    expect(game['phase']).toBe(GamePhase.BiddingRound1)

    const dealerBefore = game['currentDealer'] as number
    const firstBidder = (dealerBefore + 1) % 4
    expect(game['currentRound']!.currentPlayer).toBe(firstBidder)

    // Round 1: all pass → BiddingRound2
    for (let i = 0; i < 4; i++) passCurrent()
    expect(game['phase']).toBe(GamePhase.BiddingRound2)
    expect(game['passCount']).toBe(0)
    expect(game['currentRound']!.biddingRound).toBe(2)
    expect(game['currentRound']!.currentPlayer).toBe(firstBidder)

    // Round 2: all pass → redeal (rotate dealer)
    for (let i = 0; i < 4; i++) passCurrent()

    const expectedDealer = (dealerBefore + 1) % 4
    expect(game['currentDealer']).toBe(expectedDealer)
    expect(game['passCount']).toBe(0)
    // startNewRound sets Dealing immediately
    expect(game['phase']).toBe(GamePhase.Dealing)
    expect(game['currentRound']!.dealer).toBe(expectedDealer)
    expect(game['currentRound']!.biddingRound).toBe(1)
    expect(game['currentRound']!.trump).toBeNull()
    expect(game['currentRound']!.currentPlayer).toBe((expectedDealer + 1) % 4)

    // After deal pause, bidding starts again (no hang)
    vi.advanceTimersByTime(GameTimings.phasePauseMs)
    expect(game['phase']).toBe(GamePhase.BiddingRound1)
  })
})
