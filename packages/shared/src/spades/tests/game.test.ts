import { describe, it, expect } from 'vitest'
import { SpadesPhase, SpadesBidType } from '../types.js'
import { createSpadesGame, dealSpadesCards, processBid } from '../game.js'

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
})
