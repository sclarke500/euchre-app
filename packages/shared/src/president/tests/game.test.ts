import { describe, it, expect } from 'vitest'
import { PresidentPhase, type PresidentGameState, type TurnStyleRule } from '../types.js'
import { createPresidentGame, dealPresidentCards, processPlay, processPass, DEFAULT_PRESIDENT_RULES } from '../game.js'
import { FullRank, Suit, type StandardCard } from '../../core/types.js'

function card(rank: FullRank, suit: Suit = Suit.Hearts): StandardCard {
  return { suit, rank, id: `${suit}-${rank}` }
}

describe('president game', () => {
  it('requires 4-8 players', () => {
    expect(() => createPresidentGame(['A', 'B', 'C'])).toThrow('President requires 4-8 players')
    expect(() => createPresidentGame(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])).toThrow('President requires 4-8 players')
  })

  it('creates game with default rules merged with overrides', () => {
    const state = createPresidentGame(['A', 'B', 'C', 'D'], 0, { superTwosMode: true })

    expect(state.phase).toBe(PresidentPhase.Setup)
    expect(state.players).toHaveLength(4)
    expect(state.rules).toEqual({
      ...DEFAULT_PRESIDENT_RULES,
      superTwosMode: true,
    })
  })

  it('deals expected number of cards by mode', () => {
    const normal = dealPresidentCards(createPresidentGame(['A', 'B', 'C', 'D'], 0, { superTwosMode: false }))
    const normalTotal = normal.players.reduce((sum, p) => sum + p.hand.length, 0)

    const superTwos = dealPresidentCards(createPresidentGame(['A', 'B', 'C', 'D'], 0, { superTwosMode: true }))
    const superTwosTotal = superTwos.players.reduce((sum, p) => sum + p.hand.length, 0)

    expect(normal.phase).toBe(PresidentPhase.Dealing)
    expect(superTwos.phase).toBe(PresidentPhase.Dealing)
    expect(normalTotal).toBe(52)
    expect(superTwosTotal).toBe(54)
  })
})

describe('lead after a player goes out', () => {
  // 5-player game in Playing phase where player 1 is about to play their
  // final card (an ace nobody else can beat, so everyone must pass).
  function setupPlayerOneAboutToGoOut(turnStyle: TurnStyleRule): PresidentGameState {
    const base = createPresidentGame(['A', 'B', 'C', 'D', 'E'], 0, { turnStyle })
    const hands: StandardCard[][] = [
      [card(FullRank.Four, Suit.Clubs), card(FullRank.Five, Suit.Clubs)],
      [card(FullRank.Ace, Suit.Spades)],
      [card(FullRank.Four, Suit.Hearts), card(FullRank.Five, Suit.Hearts)],
      [card(FullRank.Four, Suit.Diamonds), card(FullRank.Five, Suit.Diamonds)],
      [card(FullRank.Four, Suit.Spades), card(FullRank.Five, Suit.Spades)],
    ]
    return {
      ...base,
      phase: PresidentPhase.Playing,
      players: base.players.map((p, i) => ({ ...p, hand: hands[i]! })),
      currentPlayer: 1,
    }
  }

  it.each(['original', 'passLockout', 'singleRound'] as TurnStyleRule[])(
    '%s: player to the left of the finished player leads the next trick',
    (turnStyle) => {
      let state = setupPlayerOneAboutToGoOut(turnStyle)
      state = processPlay(state, 1, [card(FullRank.Ace, Suit.Spades)])
      expect(state.players[1]!.finishOrder).toBe(1)

      // Everyone still in must get a chance to beat the pile before it clears
      for (const passer of [2, 3, 4, 0]) {
        expect(state.currentPlayer).toBe(passer)
        expect(state.currentPile.currentRank).toBe(FullRank.Ace)
        state = processPass(state, passer)
      }

      // Pile cleared, and the lead went to player 2 (left of finished player 1)
      expect(state.currentPile.currentRank).toBeNull()
      expect(state.passedThisTrick).toEqual([])
      expect(state.currentPlayer).toBe(2)
    }
  )

  it.each(['original', 'passLockout', 'singleRound'] as TurnStyleRule[])(
    '%s: pile owner who is still in leads again when everyone passes',
    (turnStyle) => {
      let state = setupPlayerOneAboutToGoOut(turnStyle)
      // Give player 1 a second card so they stay in after playing the ace
      state = {
        ...state,
        players: state.players.map(p =>
          p.id === 1 ? { ...p, hand: [...p.hand, card(FullRank.Three, Suit.Clubs)] } : p
        ),
      }
      state = processPlay(state, 1, [card(FullRank.Ace, Suit.Spades)])
      expect(state.players[1]!.finishOrder).toBeNull()

      for (const passer of [2, 3, 4, 0]) {
        expect(state.currentPlayer).toBe(passer)
        state = processPass(state, passer)
      }

      expect(state.currentPile.currentRank).toBeNull()
      expect(state.currentPlayer).toBe(1)
    }
  )
})
