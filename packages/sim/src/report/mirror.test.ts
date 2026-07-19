import { describe, it, expect } from 'vitest'
import {
  buildMirrorReport,
  rotatePolicies,
  scoreMirrorPair,
} from './mirror.js'
import type { GameStats } from '../types.js'

function fakeStats(
  winner: number | null,
  scores: [number, number],
  policies: [string, string, string, string] = ['hard', 'easy', 'hard', 'easy']
): GameStats {
  return {
    gameIndex: 0,
    seed: 1,
    winner,
    finalScores: scores,
    hands: 10,
    steps: 100,
    aloneHands: 0,
    pointsPerHand: 1,
    policyIds: policies,
    fallbackCount: 0,
  }
}

describe('mirror scoring', () => {
  it('rotates policies by +1', () => {
    expect(rotatePolicies(['hard', 'easy', 'hard', 'easy'])).toEqual([
      'easy',
      'hard',
      'easy',
      'hard',
    ])
  })

  it('counts challenger wins on both seats', () => {
    // A: challenger team0 wins; B: challenger team1 wins → 2
    const pair = scoreMirrorPair(
      0,
      42,
      fakeStats(0, [10, 6]),
      fakeStats(1, [4, 10])
    )
    expect(pair.challengerGameWins).toBe(2)
    expect(pair.challengerPointMargin).toBe(10 - 6 + (10 - 4))
  })

  it('1–1 is a pair tie in the report', () => {
    const pairs = [
      scoreMirrorPair(0, 1, fakeStats(0, [10, 8]), fakeStats(0, [10, 5])), // A win, B loss → 1
    ]
    const r = buildMirrorReport(pairs)
    expect(r.pairTies).toBe(1)
    expect(r.challengerPairWins).toBe(0)
    expect(r.opponentPairWins).toBe(0)
  })
})
