import { describe, it, expect } from 'vitest'
import { Suit } from '../types.js'
import type { Trick, Trump } from '../types.js'
import { calculateRoundScore, updateScores, isGameOver, getWinner } from '../scoring.js'

function makeTricks(winners: number[]): Trick[] {
  return winners.map(winnerId => ({
    cards: [],
    leadingSuit: null,
    winnerId,
  }))
}

describe('calculateRoundScore', () => {
  const trump = (calledBy: number, goingAlone = false): Trump => ({
    suit: Suit.Spades,
    calledBy,
    goingAlone,
  })

  it('awards 1 point for winning 3-4 tricks', () => {
    // Team 0 called trump (player 0) and won 3 tricks
    const tricks = makeTricks([0, 1, 0, 1, 2]) // team0: 3, team1: 2
    const score = calculateRoundScore(tricks, trump(0))
    expect(score.team0Points).toBe(1)
    expect(score.team1Points).toBe(0)
    expect(score.wasEuchre).toBe(false)
    expect(score.wasMarch).toBe(false)
  })

  it('awards 2 points for march (all 5 tricks)', () => {
    const tricks = makeTricks([0, 2, 0, 2, 0]) // team0: 5, team1: 0
    const score = calculateRoundScore(tricks, trump(0))
    expect(score.team0Points).toBe(2)
    expect(score.team1Points).toBe(0)
    expect(score.wasMarch).toBe(true)
  })

  it('awards 2 points for euchre (defending team wins 3+)', () => {
    // Team 0 called trump but team 1 won 3+ tricks
    const tricks = makeTricks([1, 3, 1, 0, 3]) // team0: 1, team1: 4
    const score = calculateRoundScore(tricks, trump(0))
    expect(score.team0Points).toBe(0)
    expect(score.team1Points).toBe(2)
    expect(score.wasEuchre).toBe(true)
  })

  it('awards 4 points for alone march', () => {
    const tricks = makeTricks([0, 0, 2, 0, 2]) // team0: 5
    const score = calculateRoundScore(tricks, trump(0, true))
    expect(score.team0Points).toBe(4)
    expect(score.team1Points).toBe(0)
    expect(score.wasMarch).toBe(true)
    expect(score.wasLoneHand).toBe(true)
  })

  it('awards 1 point for alone with 3-4 tricks', () => {
    const tricks = makeTricks([0, 1, 0, 1, 2]) // team0: 3, team1: 2
    const score = calculateRoundScore(tricks, trump(0, true))
    expect(score.team0Points).toBe(1)
    expect(score.team1Points).toBe(0)
  })

  it('works when team 1 calls trump', () => {
    // Team 1 (player 1) calls trump and wins 4 tricks
    const tricks = makeTricks([1, 3, 1, 0, 3]) // team0: 1, team1: 4
    const score = calculateRoundScore(tricks, trump(1))
    expect(score.team0Points).toBe(0)
    expect(score.team1Points).toBe(1) // 3-4 tricks = 1 point
  })

  it('euchre works when team 1 calls trump and team 0 defends', () => {
    // Team 1 (player 1) calls trump but team 0 wins 3 tricks
    const tricks = makeTricks([0, 2, 0, 1, 2]) // team0: 4, team1: 1
    const score = calculateRoundScore(tricks, trump(1))
    expect(score.team0Points).toBe(2)
    expect(score.team1Points).toBe(0)
    expect(score.wasEuchre).toBe(true)
  })

  it('throws when trump is null', () => {
    expect(() => calculateRoundScore([], null)).toThrow('Cannot calculate score without trump')
  })
})

describe('updateScores', () => {
  it('adds round points to current scores', () => {
    const result = updateScores([5, 3], {
      team0Points: 2,
      team1Points: 0,
      wasEuchre: false,
      wasMarch: true,
      wasLoneHand: false,
    })
    expect(result).toEqual([7, 3])
  })
})

describe('isGameOver', () => {
  it('returns false when both teams under 10', () => {
    expect(isGameOver([9, 9])).toBe(false)
  })

  it('returns true when a team reaches 10', () => {
    expect(isGameOver([10, 5])).toBe(true)
    expect(isGameOver([5, 10])).toBe(true)
  })

  it('returns true when a team exceeds 10', () => {
    expect(isGameOver([12, 5])).toBe(true)
  })
})

describe('getWinner', () => {
  it('returns null when game not over', () => {
    expect(getWinner([5, 5])).toBeNull()
  })

  it('returns team 0 when they reach 10', () => {
    expect(getWinner([10, 5])).toBe(0)
  })

  it('returns team 1 when they reach 10', () => {
    expect(getWinner([5, 10])).toBe(1)
  })

  it('team 0 wins ties at 10+', () => {
    // Both at 10 — team 0 checked first
    expect(getWinner([10, 10])).toBe(0)
  })
})
