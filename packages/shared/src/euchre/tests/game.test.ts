import { describe, it, expect } from 'vitest'
import { BidAction, GamePhase, Suit } from '../types.js'
import {
  applyBid,
  applyDealerDiscard,
  applyEuchreAction,
  applyPlay,
  continueAfterTrick,
  createEuchreGame,
  dealRound,
  legalEuchreActions,
  startBiddingRound1,
} from '../game.js'

/** Deterministic RNG that cycles a fixed sequence */
function fixedRng(seed = 1): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return (s % 10000) / 10000
  }
}

describe('euchre pure game machine', () => {
  it('creates a 4-player game in Setup', () => {
    const g = createEuchreGame(['A', 'B', 'C', 'D'])
    expect(g.phase).toBe(GamePhase.Setup)
    expect(g.players).toHaveLength(4)
    expect(g.rules.stickTheDealer).toBe(false)
  })

  it('deals 5 cards each and starts left of dealer', () => {
    let g = createEuchreGame(['A', 'B', 'C', 'D'])
    g = { ...g, currentDealer: 2 }
    g = dealRound(g, fixedRng(42))
    expect(g.phase).toBe(GamePhase.Dealing)
    expect(g.players.every(p => p.hand.length === 5)).toBe(true)
    expect(g.currentRound?.currentPlayer).toBe(3)
    expect(g.passCount).toBe(0)
  })

  it('R1 all-pass advances to BiddingRound2', () => {
    let g = createEuchreGame(['A', 'B', 'C', 'D'])
    g = dealRound(g, fixedRng(1))
    g = startBiddingRound1(g)
    const first = g.currentRound!.currentPlayer
    for (let i = 0; i < 4; i++) {
      const seat = g.currentRound!.currentPlayer
      const next = applyBid(g, { playerId: seat, action: BidAction.Pass })
      expect(next).not.toBe(g)
      g = next
    }
    expect(g.phase).toBe(GamePhase.BiddingRound2)
    expect(g.passCount).toBe(0)
    expect(g.currentRound!.currentPlayer).toBe(first)
  })

  it('R2 all-pass redeals and rotates dealer when stickTheDealer is false', () => {
    let g = createEuchreGame(['A', 'B', 'C', 'D'], 0, { stickTheDealer: false })
    g = { ...g, currentDealer: 1 }
    g = dealRound(g, fixedRng(2))
    g = startBiddingRound1(g)
    // R1 all pass
    for (let i = 0; i < 4; i++) {
      g = applyBid(g, { playerId: g.currentRound!.currentPlayer, action: BidAction.Pass })
    }
    expect(g.phase).toBe(GamePhase.BiddingRound2)
    // R2 all pass → redeal
    for (let i = 0; i < 4; i++) {
      g = applyBid(g, { playerId: g.currentRound!.currentPlayer, action: BidAction.Pass })
    }
    expect(g.currentDealer).toBe(2)
    expect(g.phase).toBe(GamePhase.Dealing)
    expect(g.currentRound?.biddingRound).toBe(1)
    expect(g.players.every(p => p.hand.length === 5)).toBe(true)
  })

  it('stickTheDealer rejects dealer pass when three have passed in R2', () => {
    let g = createEuchreGame(['A', 'B', 'C', 'D'], 0, { stickTheDealer: true })
    g = { ...g, currentDealer: 0 }
    g = dealRound(g, fixedRng(3))
    g = startBiddingRound1(g)
    for (let i = 0; i < 4; i++) {
      g = applyBid(g, { playerId: g.currentRound!.currentPlayer, action: BidAction.Pass })
    }
    // R2: seats 1,2,3 pass → dealer 0 must call
    for (let i = 0; i < 3; i++) {
      g = applyBid(g, { playerId: g.currentRound!.currentPlayer, action: BidAction.Pass })
    }
    expect(g.currentRound!.currentPlayer).toBe(0)
    expect(g.passCount).toBe(3)
    const rejected = applyBid(g, { playerId: 0, action: BidAction.Pass })
    expect(rejected).toBe(g)
  })

  it('canadian loner forces alone when partner orders up', () => {
    let g = createEuchreGame(['A', 'B', 'C', 'D'], 0, { canadianLoner: true })
    g = { ...g, currentDealer: 0 }
    g = dealRound(g, fixedRng(4))
    g = startBiddingRound1(g)
    // Partner of dealer is seat 2 — pass seats 1 if needed so 2 acts... left of dealer is 1 first
    // Pass seat 1, then seat 2 OrderUp
    g = applyBid(g, { playerId: 1, action: BidAction.Pass })
    const next = applyBid(g, {
      playerId: 2,
      action: BidAction.OrderUp,
      goingAlone: false,
    })
    expect(next).not.toBe(g)
    expect(next.currentRound!.trump?.goingAlone).toBe(true)
    expect(next.currentRound!.alonePlayer).toBe(2)
  })

  it('order up puts dealer in DealerDiscard with 6 cards', () => {
    let g = createEuchreGame(['A', 'B', 'C', 'D'])
    g = { ...g, currentDealer: 0 }
    g = dealRound(g, fixedRng(5))
    g = startBiddingRound1(g)
    // Seat 1 orders up
    g = applyBid(g, { playerId: 1, action: BidAction.OrderUp })
    expect(g.phase).toBe(GamePhase.DealerDiscard)
    expect(g.players[0]!.hand.length).toBe(6)
    expect(g.currentRound!.currentPlayer).toBe(0)

    const discardId = g.players[0]!.hand[0]!.id
    g = applyDealerDiscard(g, discardId)
    expect(g.phase).toBe(GamePhase.Playing)
    expect(g.players[0]!.hand.length).toBe(5)
    expect(g.currentRound!.currentPlayer).toBe(1) // left of dealer
  })

  it('applyPlay rejects illegal card with same reference', () => {
    let g = createEuchreGame(['A', 'B', 'C', 'D'])
    g = dealRound(g, fixedRng(6))
    g = startBiddingRound1(g)
    // Force trump via call so we skip discard
    // Pass to R2 then call a suit from dealer
    for (let i = 0; i < 4; i++) {
      g = applyBid(g, { playerId: g.currentRound!.currentPlayer, action: BidAction.Pass })
    }
    const caller = g.currentRound!.currentPlayer
    g = applyBid(g, {
      playerId: caller,
      action: BidAction.CallTrump,
      suit: Suit.Hearts,
    })
    expect(g.phase).toBe(GamePhase.Playing)

    const lead = g.currentRound!.currentPlayer
    const hand = g.players[lead]!.hand
    // Pick a card not in hand
    const rejected = applyPlay(g, lead, 'not-a-card')
    expect(rejected).toBe(g)

    // Legal play
    const ok = applyPlay(g, lead, hand[0]!.id)
    expect(ok).not.toBe(g)
    expect(ok.players[lead]!.hand).toHaveLength(4)
  })

  it('continueAfterTrick resumes Playing mid-round', () => {
    // Build a TrickComplete state manually after one completed trick shape
    let g = createEuchreGame(['A', 'B', 'C', 'D'])
    g = dealRound(g, fixedRng(7))
    g = startBiddingRound1(g)
    for (let i = 0; i < 4; i++) {
      g = applyBid(g, { playerId: g.currentRound!.currentPlayer, action: BidAction.Pass })
    }
    g = applyBid(g, {
      playerId: g.currentRound!.currentPlayer,
      action: BidAction.CallTrump,
      suit: Suit.Spades,
    })

    // Play until trick completes (4 cards, no alone)
    for (let i = 0; i < 4; i++) {
      const seat = g.currentRound!.currentPlayer
      const legal = g.players[seat]!.hand
      // Follow if possible: just play first card in hand (may be illegal) — use get from applyPlay loop
      let played = false
      for (const c of legal) {
        const next = applyPlay(g, seat, c.id)
        if (next !== g) {
          g = next
          played = true
          break
        }
      }
      expect(played).toBe(true)
    }
    expect(g.phase).toBe(GamePhase.TrickComplete)
    expect(g.currentRound!.tricks).toHaveLength(1)

    g = continueAfterTrick(g)
    expect(g.phase).toBe(GamePhase.Playing)
  })

  describe('legalEuchreActions (E3)', () => {
    it('R1: non-dealer gets pass + order_up alone variants; others empty', () => {
      let g = createEuchreGame(['A', 'B', 'C', 'D'])
      g = { ...g, currentDealer: 0 }
      g = dealRound(g, fixedRng(10))
      g = startBiddingRound1(g)
      const seat = g.currentRound!.currentPlayer // left of dealer = 1
      expect(seat).toBe(1)
      const legal = legalEuchreActions(g, seat)
      expect(legal).toEqual(
        expect.arrayContaining([
          { kind: 'pass' },
          { kind: 'order_up', goingAlone: false },
          { kind: 'order_up', goingAlone: true },
        ])
      )
      expect(legal).toHaveLength(3)
      expect(legalEuchreActions(g, 0)).toEqual([])
      expect(legalEuchreActions(g, 2)).toEqual([])
    })

    it('R1: dealer gets pick_up not order_up', () => {
      let g = createEuchreGame(['A', 'B', 'C', 'D'])
      g = { ...g, currentDealer: 0 }
      g = dealRound(g, fixedRng(11))
      g = startBiddingRound1(g)
      // Pass 1,2,3 → dealer
      for (let i = 0; i < 3; i++) {
        g = applyBid(g, { playerId: g.currentRound!.currentPlayer, action: BidAction.Pass })
      }
      expect(g.currentRound!.currentPlayer).toBe(0)
      const legal = legalEuchreActions(g, 0)
      expect(legal.map(a => a.kind).sort()).toEqual(['pass', 'pick_up', 'pick_up'])
      expect(legal.some(a => a.kind === 'order_up')).toBe(false)
    })

    it('R2: excludes turn-up suit; stickTheDealer blocks dealer pass', () => {
      let g = createEuchreGame(['A', 'B', 'C', 'D'], 0, { stickTheDealer: true })
      g = { ...g, currentDealer: 0 }
      g = dealRound(g, fixedRng(12))
      g = startBiddingRound1(g)
      for (let i = 0; i < 4; i++) {
        g = applyBid(g, { playerId: g.currentRound!.currentPlayer, action: BidAction.Pass })
      }
      expect(g.phase).toBe(GamePhase.BiddingRound2)
      const turnSuit = g.currentRound!.turnUpCard!.suit
      const legalR2 = legalEuchreActions(g, g.currentRound!.currentPlayer)
      expect(legalR2.some(a => a.kind === 'pass')).toBe(true)
      for (const a of legalR2) {
        if (a.kind === 'call_trump') {
          expect(a.suit).not.toBe(turnSuit)
        }
      }
      // 1 pass + 3 suits × 2 alone = 7
      expect(legalR2).toHaveLength(7)

      // Three R2 passes → dealer stuck
      for (let i = 0; i < 3; i++) {
        g = applyBid(g, { playerId: g.currentRound!.currentPlayer, action: BidAction.Pass })
      }
      expect(g.currentRound!.currentPlayer).toBe(0)
      const dealerLegal = legalEuchreActions(g, 0)
      expect(dealerLegal.some(a => a.kind === 'pass')).toBe(false)
      expect(dealerLegal.every(a => a.kind === 'call_trump')).toBe(true)
      expect(dealerLegal).toHaveLength(6)
    })

    it('discard and play enumerate hand cards; applyEuchreAction matches apply*', () => {
      let g = createEuchreGame(['A', 'B', 'C', 'D'])
      g = { ...g, currentDealer: 0 }
      g = dealRound(g, fixedRng(13))
      g = startBiddingRound1(g)
      g = applyEuchreAction(g, 1, { kind: 'order_up', goingAlone: false })
      expect(g.phase).toBe(GamePhase.DealerDiscard)
      const discardLegal = legalEuchreActions(g, 0)
      expect(discardLegal).toHaveLength(6)
      expect(discardLegal.every(a => a.kind === 'discard')).toBe(true)
      const discardId = (discardLegal[0] as { cardId: string }).cardId
      g = applyEuchreAction(g, 0, { kind: 'discard', cardId: discardId })
      expect(g.phase).toBe(GamePhase.Playing)

      const lead = g.currentRound!.currentPlayer
      const playLegal = legalEuchreActions(g, lead)
      expect(playLegal.length).toBeGreaterThan(0)
      expect(playLegal.every(a => a.kind === 'play')).toBe(true)
      const next = applyEuchreAction(g, lead, playLegal[0]!)
      expect(next).not.toBe(g)
      expect(next.players[lead]!.hand).toHaveLength(4)
    })
  })
})
