import { describe, it, expect } from 'vitest'
import { runEuchreSim } from './euchre.js'
import { buildReport } from '../report/summary.js'

describe('euchre sim runner', () => {
  it('completes hard-only games and tags teacher steps', async () => {
    const { stats, stepsWritten } = await runEuchreSim({
      games: 5,
      seed: 99,
      epsilon: 0.1,
      policies: ['hard', 'hard', 'hard', 'hard'],
      outPath: null,
    })
    expect(stats).toHaveLength(5)
    expect(stepsWritten).toBeGreaterThan(0)
    for (const g of stats) {
      expect(g.steps).toBeGreaterThan(0)
      // Most games should finish to 10
      expect(g.finalScores[0]! + g.finalScores[1]!).toBeGreaterThanOrEqual(10)
      expect(g.fallbackCount).toBe(0)
    }
  })

  it('hard vs easy mix produces a report', async () => {
    const { stats } = await runEuchreSim({
      games: 20,
      seed: 7,
      epsilon: 0.1,
      policies: ['hard', 'easy', 'hard', 'easy'],
      outPath: null,
    })
    const report = buildReport(stats)
    expect(report.games).toBe(20)
    expect(report.hardVsEasy).toBeDefined()
    expect(
      (report.hardVsEasy!.hardSeatWins + report.hardVsEasy!.easySeatWins) > 0
    ).toBe(true)
  })

  it('default mix runs without throwing', async () => {
    const { stats } = await runEuchreSim({
      games: 10,
      seed: 1,
      epsilon: 0.1,
      outPath: null,
    })
    expect(stats).toHaveLength(10)
  })
})
