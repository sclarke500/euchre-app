import { describe, it, expect } from 'vitest'
import { SpadesPhase, SpadesBidType } from '../spades/types.js'
import {
  createSpadesGame,
  dealSpadesCards,
  processBid,
  startBiddingPhase,
} from '../spades/game.js'
import { BidAction, GamePhase, Suit } from '../euchre/types.js'
import {
  applyBid,
  createEuchreGame,
  dealRound,
  startBiddingRound1,
} from '../euchre/game.js'
import { runGoldenReplay } from './golden.js'

describe('golden replay harness', () => {
  it('replays Spades bidding to Playing', () => {
    const dealt = dealSpadesCards({
      ...createSpadesGame(['A', 'B', 'C', 'D']),
      dealer: 1,
    })
    const initial = startBiddingPhase(dealt)

    const final = runGoldenReplay({
      name: 'spades-all-bid',
      initialState: initial,
      apply: (state, seat, action) => processBid(state, seat, action),
      steps: [
        { seat: 2, action: { type: SpadesBidType.Normal, count: 3 } },
        { seat: 3, action: { type: SpadesBidType.Normal, count: 2 } },
        { seat: 0, action: { type: SpadesBidType.Nil, count: 0 } },
        { seat: 1, action: { type: SpadesBidType.Normal, count: 4 } },
      ],
      expect: {
        phase: SpadesPhase.Playing,
        assert: (s) => {
          expect(s.bidsComplete).toBe(true)
          expect(s.players.every(p => p.bid !== null)).toBe(true)
        },
      },
    }).finalState

    expect(final.currentPlayer).toBe(2)
  })

  it('detects Spades same-ref reject for illegal normal-0 bid', () => {
    const dealt = dealSpadesCards({
      ...createSpadesGame(['A', 'B', 'C', 'D']),
      dealer: 0,
    })
    const initial = startBiddingPhase(dealt)
    const seat = initial.currentPlayer

    runGoldenReplay({
      name: 'spades-reject-zero',
      initialState: initial,
      apply: (state, s, action) => processBid(state, s, action),
      steps: [
        {
          seat,
          action: { type: SpadesBidType.Normal, count: 0 },
          expectReject: true,
          label: 'normal-0',
        },
      ],
    })
  })

  it('replays Euchre R1 all-pass to BiddingRound2', () => {
    let g = createEuchreGame(['A', 'B', 'C', 'D'])
    g = { ...g, currentDealer: 0 }
    g = dealRound(g, () => 0.3)
    g = startBiddingRound1(g)

    const seats = [1, 2, 3, 0] // left of dealer 0
    const final = runGoldenReplay({
      name: 'euchre-r1-all-pass-seats',
      initialState: g,
      apply: (state, seat, action) =>
        applyBid(state, { playerId: seat, action: action.action }),
      steps: seats.map((seat) => ({
        seat,
        action: { action: BidAction.Pass },
      })),
      expect: {
        phase: GamePhase.BiddingRound2,
        assert: (s) => {
          expect(s.passCount).toBe(0)
          expect(s.currentRound?.biddingRound).toBe(2)
        },
      },
    }).finalState

    expect(final.currentRound?.currentPlayer).toBe(1)
  })

  it('replays Euchre CallTrump to Playing', () => {
    let g = createEuchreGame(['A', 'B', 'C', 'D'])
    g = { ...g, currentDealer: 0 }
    g = dealRound(g, () => 0.11)
    g = startBiddingRound1(g)
    for (const seat of [1, 2, 3, 0]) {
      g = applyBid(g, { playerId: seat, action: BidAction.Pass })
    }
    expect(g.phase).toBe(GamePhase.BiddingRound2)

    const final = runGoldenReplay({
      name: 'euchre-call-hearts',
      initialState: g,
      apply: (state, seat, action) =>
        applyBid(state, {
          playerId: seat,
          action: action.action,
          suit: action.suit,
        }),
      steps: [
        {
          seat: 1,
          action: { action: BidAction.CallTrump, suit: Suit.Hearts },
        },
      ],
      expect: {
        phase: GamePhase.Playing,
        assert: (s) => {
          expect(s.currentRound?.trump?.suit).toBe(Suit.Hearts)
          expect(s.currentRound?.trump?.calledBy).toBe(1)
        },
      },
    }).finalState

    expect(final.phase).toBe(GamePhase.Playing)
  })

  it('throws when legal step returns same ref', () => {
    const dealt = dealSpadesCards(createSpadesGame(['A', 'B', 'C', 'D']))
    const initial = startBiddingPhase(dealt)
    expect(() =>
      runGoldenReplay({
        name: 'force-fail',
        initialState: initial,
        apply: (state) => state, // always same ref
        steps: [
          {
            seat: initial.currentPlayer,
            action: { type: SpadesBidType.Normal, count: 3 },
          },
        ],
      })
    ).toThrow(/expected legal transition/)
  })
})
