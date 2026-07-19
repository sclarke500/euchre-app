import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  FullRank,
  Suit,
  SpadesBidType,
  SpadesPhase,
  GameTimings,
  type StandardCard,
} from '@67cards/shared'
import { SpadesGame } from './SpadesGame.js'

function card(suit: Suit, rank: FullRank): StandardCard {
  return { suit, rank, id: `${suit}-${rank}` }
}

/**
 * Server host must drive plays through pure Spades.playCard (same-ref reject).
 */
describe('SpadesGame pure play path', () => {
  let game: SpadesGame
  let onCardPlayed: ReturnType<typeof vi.fn>
  let onTrickComplete: ReturnType<typeof vi.fn>
  let onRoundComplete: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    onCardPlayed = vi.fn()
    onTrickComplete = vi.fn()
    onRoundComplete = vi.fn()

    game = new SpadesGame('test-pure-play', {
      onStateChange: vi.fn() as any,
      onBidMade: vi.fn() as any,
      onCardPlayed: onCardPlayed as any,
      onTrickComplete: onTrickComplete as any,
      onRoundComplete: onRoundComplete as any,
      onGameOver: vi.fn() as any,
      onYourTurn: vi.fn() as any,
      onTurnReminder: vi.fn() as any,
      onPlayerTimedOut: vi.fn() as any,
      onPlayerBooted: vi.fn() as any,
      onPlayerDisconnected: vi.fn() as any,
      onPlayerReconnected: vi.fn() as any,
    })

    game.initializePlayers([
      { odusId: 'p0', name: 'P0', seatIndex: 0 },
      { odusId: 'p1', name: 'P1', seatIndex: 1 },
      { odusId: 'p2', name: 'P2', seatIndex: 2 },
      { odusId: 'p3', name: 'P3', seatIndex: 3 },
    ])
    game.start()
    vi.advanceTimersByTime(GameTimings.roundPauseMs)
  })

  afterEach(() => {
    game.cleanup?.()
    vi.useRealTimers()
  })

  function bidAll(count = 3): void {
    for (let i = 0; i < 4; i++) {
      const seat = game['currentPlayer'] as number
      const odusId = game['players'][seat]!.odusId!
      expect(game.handleBid(odusId, { type: SpadesBidType.Normal, count })).toBe(true)
    }
    expect(game['phase']).toBe(SpadesPhase.Playing)
  }

  /** Fixed hands so lead is known; everyone can follow spades. */
  function injectPlayHands(): void {
    // Seat left of dealer leads — force dealer=3 so seat 0 leads
    game['dealer'] = 3
    game['currentPlayer'] = 0
    game['players'][0]!.hand = [
      card(Suit.Spades, FullRank.Ace),
      card(Suit.Hearts, FullRank.Two),
      ...Array.from({ length: 11 }, (_, i) =>
        card(Suit.Clubs, Object.values(FullRank)[i] as FullRank)
      ),
    ]
    // Fix club ids uniqueness
    game['players'][0]!.hand = [
      card(Suit.Spades, FullRank.Ace),
      card(Suit.Hearts, FullRank.Two),
      card(Suit.Clubs, FullRank.Three),
      card(Suit.Clubs, FullRank.Four),
      card(Suit.Clubs, FullRank.Five),
      card(Suit.Clubs, FullRank.Six),
      card(Suit.Clubs, FullRank.Seven),
      card(Suit.Clubs, FullRank.Eight),
      card(Suit.Clubs, FullRank.Nine),
      card(Suit.Clubs, FullRank.Ten),
      card(Suit.Clubs, FullRank.Jack),
      card(Suit.Clubs, FullRank.Queen),
      card(Suit.Clubs, FullRank.King),
    ]
    game['players'][1]!.hand = [
      card(Suit.Spades, FullRank.King),
      card(Suit.Hearts, FullRank.Three),
      card(Suit.Diamonds, FullRank.Two),
      card(Suit.Diamonds, FullRank.Three),
      card(Suit.Diamonds, FullRank.Four),
      card(Suit.Diamonds, FullRank.Five),
      card(Suit.Diamonds, FullRank.Six),
      card(Suit.Diamonds, FullRank.Seven),
      card(Suit.Diamonds, FullRank.Eight),
      card(Suit.Diamonds, FullRank.Nine),
      card(Suit.Diamonds, FullRank.Ten),
      card(Suit.Diamonds, FullRank.Jack),
      card(Suit.Diamonds, FullRank.Queen),
    ]
    game['players'][2]!.hand = [
      card(Suit.Spades, FullRank.Queen),
      card(Suit.Hearts, FullRank.Four),
      card(Suit.Hearts, FullRank.Five),
      card(Suit.Hearts, FullRank.Six),
      card(Suit.Hearts, FullRank.Seven),
      card(Suit.Hearts, FullRank.Eight),
      card(Suit.Hearts, FullRank.Nine),
      card(Suit.Hearts, FullRank.Ten),
      card(Suit.Hearts, FullRank.Jack),
      card(Suit.Hearts, FullRank.Queen),
      card(Suit.Hearts, FullRank.King),
      card(Suit.Hearts, FullRank.Ace),
      card(Suit.Diamonds, FullRank.King),
    ]
    game['players'][3]!.hand = [
      card(Suit.Spades, FullRank.Jack),
      card(Suit.Spades, FullRank.Ten),
      card(Suit.Spades, FullRank.Nine),
      card(Suit.Spades, FullRank.Eight),
      card(Suit.Spades, FullRank.Seven),
      card(Suit.Spades, FullRank.Six),
      card(Suit.Spades, FullRank.Five),
      card(Suit.Spades, FullRank.Four),
      card(Suit.Spades, FullRank.Three),
      card(Suit.Spades, FullRank.Two),
      card(Suit.Clubs, FullRank.Ace),
      card(Suit.Clubs, FullRank.Two),
      card(Suit.Diamonds, FullRank.Ace),
    ]
  }

  it('rejects illegal play with false (same-ref pure path)', () => {
    bidAll()
    injectPlayHands()
    // Lead hearts (spades not broken) — p0 has hearts-2
    expect(game.handlePlayCard('p0', 'hearts-2')).toBe(true)
    // p1 has hearts-3 and must follow; cannot dump diamonds while holding hearts
    expect(game.handlePlayCard('p1', 'diamonds-2')).toBe(false)
    expect(game['currentPlayer']).toBe(1)
    expect(game['currentTrick'].cards).toHaveLength(1)
  })

  it('completes a trick via pure playCard and continues with winner leading', () => {
    bidAll()
    injectPlayHands()
    // Hearts lead; p0 has 2, p1 3, p2 4, p3 has no hearts → can ruff with spade-J
    expect(game.handlePlayCard('p0', 'hearts-2')).toBe(true)
    expect(game.handlePlayCard('p1', 'hearts-3')).toBe(true)
    expect(game.handlePlayCard('p2', 'hearts-4')).toBe(true)
    expect(game.handlePlayCard('p3', 'spades-J')).toBe(true)

    expect(onCardPlayed).toHaveBeenCalledTimes(4)
    expect(onTrickComplete).toHaveBeenCalledTimes(1)
    expect(game['phase']).toBe(SpadesPhase.TrickComplete)
    expect(game['completedTricks']).toHaveLength(1)
    // Spade ruff wins
    expect(game['players'][3]!.tricksWon).toBe(1)
    expect(game['currentPlayer']).toBe(3)

    vi.advanceTimersByTime(GameTimings.trickPauseMs)
    expect(game['phase']).toBe(SpadesPhase.Playing)
    expect(game['currentPlayer']).toBe(3)
    expect(game['currentTrick'].cards).toHaveLength(0)
  })

  it('does not double-score when 13th trick completes via pure playCard', () => {
    bidAll(1)
    // Minimal: force 12 completed tricks already and 1 card left each, finish last trick
    injectPlayHands()
    // Strip hands down so only one trick remains (4 cards)
    for (let s = 0; s < 4; s++) {
      game['players'][s]!.hand = game['players'][s]!.hand.slice(0, 1)
      game['players'][s]!.tricksWon = s === 0 ? 12 : 0
    }
    // Fabricate 12 completed tricks so pure path scores on next
    game['completedTricks'] = Array.from({ length: 12 }, () => ({
      cards: [],
      leadingSuit: Suit.Clubs,
      winnerId: 0,
    }))
    game['currentPlayer'] = 0
    game['spadesBroken'] = true
    game['currentTrick'] = { cards: [], leadingSuit: null, winnerId: null }

    const scoreBefore = game['scores'][0]!.score

    const c0 = game['players'][0]!.hand[0]!.id
    const c1 = game['players'][1]!.hand[0]!.id
    const c2 = game['players'][2]!.hand[0]!.id
    const c3 = game['players'][3]!.hand[0]!.id

    expect(game.handlePlayCard('p0', c0)).toBe(true)
    expect(game.handlePlayCard('p1', c1)).toBe(true)
    expect(game.handlePlayCard('p2', c2)).toBe(true)
    expect(game.handlePlayCard('p3', c3)).toBe(true)

    // Scores applied once by pure completeRound inside playCard
    const scoreAfterPlay = game['scores'][0]!.score
    expect(scoreAfterPlay).not.toBe(scoreBefore)

    vi.advanceTimersByTime(GameTimings.roundPauseMs)
    // emitRoundCompleteAfterScoring must not re-apply completeRound
    expect(game['scores'][0]!.score).toBe(scoreAfterPlay)
    expect(onRoundComplete).toHaveBeenCalledTimes(1)
  })
})
