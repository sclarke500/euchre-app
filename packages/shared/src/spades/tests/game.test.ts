import { describe, it, expect } from 'vitest'
import { SpadesPhase, SpadesBidType } from '../types.js'
import {
  createSpadesGame,
  dealSpadesCards,
  processBid,
  processRevealHand,
  startBiddingPhase,
  startNewRound,
} from '../game.js'

describe('spades game', () => {
  it('requires exactly 4 players', () => {
    expect(() => createSpadesGame(['A', 'B', 'C'])).toThrow('Spades requires exactly 4 players')
    expect(() => createSpadesGame(['A', 'B', 'C', 'D', 'E'])).toThrow('Spades requires exactly 4 players')
  })

  it('deals 13 cards to each player and starts with bidder left of dealer', () => {
    const state = createSpadesGame(['A', 'B', 'C', 'D'])
    const withDealer = { ...state, dealer: 2 }
    const dealt = dealSpadesCards(withDealer)

    expect(dealt.phase).toBe(SpadesPhase.Dealing)
    expect(dealt.players).toHaveLength(4)
    expect(dealt.players.every(p => p.hand.length === 13)).toBe(true)
    expect(dealt.currentPlayer).toBe(3)
    expect(dealt.bidsComplete).toBe(false)
    expect(dealt.completedTricks).toHaveLength(0)
    expect(dealt.handRevealed.every(Boolean)).toBe(true)
  })

  it('transitions to playing phase after all players bid', () => {
    const state = createSpadesGame(['A', 'B', 'C', 'D'])
    const dealt = dealSpadesCards({ ...state, dealer: 1 })
    const bidding = { ...dealt, phase: SpadesPhase.Bidding, currentPlayer: 2 }

    const b1 = processBid(bidding, 2, { type: SpadesBidType.Normal, count: 3 })
    const b2 = processBid(b1, 3, { type: SpadesBidType.Normal, count: 2 })
    const b3 = processBid(b2, 0, { type: SpadesBidType.Nil, count: 0 })
    const b4 = processBid(b3, 1, { type: SpadesBidType.Normal, count: 4 })

    expect(b4.phase).toBe(SpadesPhase.Playing)
    expect(b4.bidsComplete).toBe(true)
    expect(b4.currentPlayer).toBe(2)
    expect(b4.players.every(p => p.bid !== null)).toBe(true)
  })

  it('rejects normal bid of 0 (same reference) — use Nil instead', () => {
    const state = createSpadesGame(['A', 'B', 'C', 'D'])
    const dealt = dealSpadesCards({ ...state, dealer: 0 })
    const bidding = startBiddingPhase(dealt)

    const rejected = processBid(bidding, bidding.currentPlayer, {
      type: SpadesBidType.Normal,
      count: 0,
    })
    expect(rejected).toBe(bidding)
  })

  it('rejects normal bid outside 1–13 (same reference)', () => {
    const state = createSpadesGame(['A', 'B', 'C', 'D'])
    const dealt = dealSpadesCards({ ...state, dealer: 0 })
    const bidding = startBiddingPhase(dealt)
    const seat = bidding.currentPlayer

    expect(processBid(bidding, seat, { type: SpadesBidType.Normal, count: 14 })).toBe(bidding)
    expect(processBid(bidding, seat, { type: SpadesBidType.Normal, count: -1 })).toBe(bidding)
  })

  describe('blind nil pre-look', () => {
    function dealtBlindNil() {
      const state = createSpadesGame(['A', 'B', 'C', 'D'], 0, 500, -200, true)
      const withDealer = { ...state, dealer: 3 } // first bidder = 0
      const dealt = dealSpadesCards(withDealer)
      return startBiddingPhase(dealt)
    }

    it('starts with hands unrevealed when blind nil enabled', () => {
      const bidding = dealtBlindNil()
      expect(bidding.blindNilEnabled).toBe(true)
      expect(bidding.handRevealed.every(v => v === false)).toBe(true)
    })

    it('rejects BlindNil after hand is revealed (same reference)', () => {
      const bidding = dealtBlindNil()
      const seat = bidding.currentPlayer
      const revealed = processRevealHand(bidding, seat)
      expect(revealed).not.toBe(bidding)
      expect(revealed.handRevealed[seat]).toBe(true)

      const rejected = processBid(revealed, seat, {
        type: SpadesBidType.BlindNil,
        count: 0,
      })
      expect(rejected).toBe(revealed)
    })

    it('rejects normal bid before reveal when blind nil enabled', () => {
      const bidding = dealtBlindNil()
      const seat = bidding.currentPlayer
      const rejected = processBid(bidding, seat, {
        type: SpadesBidType.Normal,
        count: 3,
      })
      expect(rejected).toBe(bidding)
    })

    it('accepts BlindNil before reveal and marks seat revealed', () => {
      const bidding = dealtBlindNil()
      const seat = bidding.currentPlayer
      const next = processBid(bidding, seat, {
        type: SpadesBidType.BlindNil,
        count: 0,
      })
      expect(next).not.toBe(bidding)
      expect(next.players[seat]!.bid?.type).toBe(SpadesBidType.BlindNil)
      expect(next.handRevealed[seat]).toBe(true)
      expect(next.currentPlayer).toBe((seat + 1) % 4)
    })

    it('allows normal bid after processRevealHand', () => {
      const bidding = dealtBlindNil()
      const seat = bidding.currentPlayer
      const revealed = processRevealHand(bidding, seat)
      const next = processBid(revealed, seat, {
        type: SpadesBidType.Normal,
        count: 2,
      })
      expect(next).not.toBe(revealed)
      expect(next.players[seat]!.bid).toEqual({
        type: SpadesBidType.Normal,
        count: 2,
      })
    })
  })

  it('startNewRound rotates dealer and deals once (no double-deal in pure path)', () => {
    const state = createSpadesGame(['A', 'B', 'C', 'D'])
    const dealt = dealSpadesCards({ ...state, dealer: 1, roundNumber: 1 })
    // Bid everyone so we could complete a round — here we only care about startNewRound
    let s = startBiddingPhase(dealt)
    for (let i = 0; i < 4; i++) {
      const seat = s.currentPlayer
      s = processBid(s, seat, { type: SpadesBidType.Normal, count: 3 })
    }
    expect(s.phase).toBe(SpadesPhase.Playing)

    // Force round complete path via startNewRound directly
    const next = startNewRound({ ...s, phase: SpadesPhase.RoundComplete })
    expect(next.dealer).toBe((dealt.dealer + 1) % 4)
    expect(next.roundNumber).toBe(2)
    expect(next.players.every(p => p.hand.length === 13)).toBe(true)
    expect(next.phase).toBe(SpadesPhase.Bidding)
  })
})
