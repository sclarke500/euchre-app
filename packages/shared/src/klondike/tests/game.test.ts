import { describe, it, expect } from 'vitest'
import { FullRank, Suit } from '../../core/types.js'
import { createNewGame, checkWin, cloneState } from '../game.js'

describe('klondike game', () => {
  it('creates correct initial tableau and stock', () => {
    const state = createNewGame(3)

    expect(state.tableau).toHaveLength(7)
    expect(state.tableau.map(col => col.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7])

    // Top card in each column should be face-up; all others face-down
    for (const column of state.tableau) {
      const top = column.cards[column.cards.length - 1]
      expect(top?.faceUp).toBe(true)
      for (let i = 0; i < column.cards.length - 1; i++) {
        expect(column.cards[i]?.faceUp).toBe(false)
      }
    }

    expect(state.stock.length).toBe(24)
    expect(state.waste.length).toBe(0)
    expect(state.drawCount).toBe(3)
  })

  it('detects win only when 52 cards are in foundations', () => {
    const state = createNewGame()
    expect(checkWin(state)).toBe(false)

    const winning = cloneState(state)
    winning.foundations = [
      { suit: null, cards: Array.from({ length: 13 }, (_, i) => ({ id: `f0-${i}`, suit: Suit.Spades, rank: FullRank.Ace, faceUp: true })) },
      { suit: null, cards: Array.from({ length: 13 }, (_, i) => ({ id: `f1-${i}`, suit: Suit.Hearts, rank: FullRank.Ace, faceUp: true })) },
      { suit: null, cards: Array.from({ length: 13 }, (_, i) => ({ id: `f2-${i}`, suit: Suit.Clubs, rank: FullRank.Ace, faceUp: true })) },
      { suit: null, cards: Array.from({ length: 13 }, (_, i) => ({ id: `f3-${i}`, suit: Suit.Diamonds, rank: FullRank.Ace, faceUp: true })) },
    ]

    expect(checkWin(winning)).toBe(true)
  })

  it('cloneState returns a deep copy', () => {
    const state = createNewGame()
    const cloned = cloneState(state)

    cloned.tableau[0]!.cards[0]!.faceUp = !cloned.tableau[0]!.cards[0]!.faceUp
    expect(cloned.tableau[0]!.cards[0]!.faceUp).not.toBe(state.tableau[0]!.cards[0]!.faceUp)
  })
})
