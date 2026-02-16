import { describe, it, expect } from 'vitest'
import { PresidentPhase } from '../types.js'
import { createPresidentGame, dealPresidentCards, DEFAULT_PRESIDENT_RULES } from '../game.js'

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
