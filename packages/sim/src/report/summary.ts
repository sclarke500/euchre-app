import type { GameStats, PolicyId, RunReport } from '../types.js'

export function buildReport(stats: GameStats[]): RunReport {
  const completed = stats.filter(s => s.winner !== null || s.finalScores.some(x => x >= 10))
  let team0Wins = 0
  let team1Wins = 0
  let ties = 0
  let hands = 0
  let steps = 0
  let alone = 0
  let points = 0
  let fallback = 0

  // hard-vs-easy: games where seats 0,2 are hard and 1,3 are easy (or vice versa)
  let hardSeatWins = 0
  let easySeatWins = 0
  let hardEasyGames = 0

  for (const g of stats) {
    if (g.winner === 0) team0Wins++
    else if (g.winner === 1) team1Wins++
    else ties++
    hands += g.hands
    steps += g.steps
    alone += g.aloneHands
    points += g.pointsPerHand * Math.max(1, g.hands)
    fallback += g.fallbackCount

    const p = g.policyIds
    const t0Hard = isHardish(p[0]!) && isHardish(p[2]!)
    const t1Hard = isHardish(p[1]!) && isHardish(p[3]!)
    const t0Easy = isEasyish(p[0]!) && isEasyish(p[2]!)
    const t1Easy = isEasyish(p[1]!) && isEasyish(p[3]!)
    if ((t0Hard && t1Easy) || (t0Easy && t1Hard)) {
      hardEasyGames++
      if (g.winner === 0) {
        if (t0Hard) hardSeatWins++
        else easySeatWins++
      } else if (g.winner === 1) {
        if (t1Hard) hardSeatWins++
        else easySeatWins++
      }
    }
  }

  const n = Math.max(1, stats.length)
  return {
    games: stats.length,
    completed: completed.length,
    team0Wins,
    team1Wins,
    ties,
    avgHands: hands / n,
    avgSteps: steps / n,
    avgAloneRate: hands > 0 ? alone / hands : 0,
    avgPointsPerHand: hands > 0 ? points / hands : 0,
    fallbackSteps: fallback,
    byPolicySeat: {},
    hardVsEasy:
      hardEasyGames > 0
        ? {
            hardSeatWins,
            easySeatWins,
            note: `${hardEasyGames} games with hard partnership vs easy partnership`,
          }
        : undefined,
  }
}

function isHardish(id: PolicyId): boolean {
  return id === 'hard' || id === 'noisy_hard'
}

function isEasyish(id: PolicyId): boolean {
  return id === 'easy' || id === 'noisy_easy'
}

export function formatReport(report: RunReport): string {
  const lines = [
    '=== Sim report ===',
    `Games: ${report.games} (completed scoring: ${report.completed})`,
    `Team 0 wins: ${report.team0Wins}  Team 1 wins: ${report.team1Wins}  Ties/incomplete: ${report.ties}`,
    `Avg hands/game: ${report.avgHands.toFixed(2)}`,
    `Avg steps/game: ${report.avgSteps.toFixed(1)}`,
    `Alone rate (hands): ${(report.avgAloneRate * 100).toFixed(1)}%`,
    `Avg points awarded/hand: ${report.avgPointsPerHand.toFixed(2)}`,
    `Same-ref fallback steps: ${report.fallbackSteps}`,
  ]
  if (report.hardVsEasy) {
    const { hardSeatWins, easySeatWins, note } = report.hardVsEasy
    const total = hardSeatWins + easySeatWins
    const hardPct = total > 0 ? ((hardSeatWins / total) * 100).toFixed(1) : 'n/a'
    lines.push(`Hard vs Easy: hard partnership wins ${hardSeatWins}, easy ${easySeatWins} (${hardPct}% hard)`)
    lines.push(`  (${note})`)
  }
  return lines.join('\n')
}
