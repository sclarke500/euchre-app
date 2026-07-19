/**
 * Mirrored-deal (duplicate-style) evaluation.
 *
 * For each deal seed, play twice with partnerships swapped (policies rotated by 1).
 * Score pairs so deal luck largely cancels — the "33% rule" noise that makes
 * raw win rate a poor skill instrument in Euchre.
 */
import type { GameStats, PolicyId } from '../types.js'

export interface MirrorPairResult {
  pairIndex: number
  seed: number
  /** Orientation A: original --policies */
  gameA: { winner: number | null; scores: [number, number] }
  /** Orientation B: policies rotated +1 (teams swapped relative to cards) */
  gameB: { winner: number | null; scores: [number, number] }
  /** Challenger (= seats 0,2 of original policies) wins in {0,1,2} games of the pair */
  challengerGameWins: number
  /** Challenger point margin summed across both orientations */
  challengerPointMargin: number
}

export interface MirrorReport {
  pairs: number
  /** Fraction of pairs where challenger won more games than opponent (ties excluded from denom optionally) */
  challengerPairWinRate: number
  challengerPairWins: number
  opponentPairWins: number
  pairTies: number
  /** Mean challenger game wins per pair (0–2), /2 = game win rate across mirrored seats */
  meanChallengerGameWins: number
  challengerGameWinRate: number
  meanChallengerPointMargin: number
  /** 95% Wilson-ish approx via normal for pair win rate (ties dropped) */
  pairWinRateCi95: [number, number] | null
  note: string
}

/** Rotate seat policies by +1: [C,O,C,O] → [O,C,O,C] (partnerships swap relative to fixed deal). */
export function rotatePolicies(
  policies: [PolicyId, PolicyId, PolicyId, PolicyId]
): [PolicyId, PolicyId, PolicyId, PolicyId] {
  return [policies[1]!, policies[2]!, policies[3]!, policies[0]!]
}

/**
 * Challenger = original seats 0 and 2.
 * Game A: challenger is team 0.
 * Game B (policies rotated +1): challenger sits in seats 1 and 3 → team 1.
 */
export function scoreMirrorPair(
  pairIndex: number,
  seed: number,
  gameA: GameStats,
  gameB: GameStats
): MirrorPairResult {
  let challengerGameWins = 0
  if (gameA.winner === 0) challengerGameWins++
  if (gameB.winner === 1) challengerGameWins++

  // Point margin from challenger's perspective
  const marginA = gameA.finalScores[0]! - gameA.finalScores[1]!
  const marginB = gameB.finalScores[1]! - gameB.finalScores[0]!
  const challengerPointMargin = marginA + marginB

  return {
    pairIndex,
    seed,
    gameA: { winner: gameA.winner, scores: gameA.finalScores },
    gameB: { winner: gameB.winner, scores: gameB.finalScores },
    challengerGameWins,
    challengerPointMargin,
  }
}

export function buildMirrorReport(pairs: MirrorPairResult[]): MirrorReport {
  let challengerPairWins = 0
  let opponentPairWins = 0
  let pairTies = 0
  let sumGameWins = 0
  let sumMargin = 0

  for (const p of pairs) {
    sumGameWins += p.challengerGameWins
    sumMargin += p.challengerPointMargin
    if (p.challengerGameWins > 1) challengerPairWins++
    else if (p.challengerGameWins < 1) opponentPairWins++
    else pairTies++ // exactly 1–1
  }

  const n = Math.max(1, pairs.length)
  const decided = challengerPairWins + opponentPairWins
  const pairWinRate = decided > 0 ? challengerPairWins / decided : 0.5
  const gameWinRate = sumGameWins / (2 * n)

  return {
    pairs: pairs.length,
    challengerPairWinRate: pairWinRate,
    challengerPairWins,
    opponentPairWins,
    pairTies,
    meanChallengerGameWins: sumGameWins / n,
    challengerGameWinRate: gameWinRate,
    meanChallengerPointMargin: sumMargin / n,
    pairWinRateCi95: decided >= 10 ? wilsonCi95(challengerPairWins, decided) : null,
    note:
      'Challenger = seats 0,2 of --policies. Each pair: same deal seed, policies rotated +1. ' +
      'Pair win = won both games of the pair; 1–1 is a pair tie. ' +
      'Deal luck largely cancels; use this over raw win rate for skill comparisons.',
  }
}

/** Wilson score interval for a binomial proportion. */
function wilsonCi95(successes: number, n: number): [number, number] {
  const z = 1.96
  const p = successes / n
  const denom = 1 + (z * z) / n
  const center = p + (z * z) / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)
  return [(center - margin) / denom, (center + margin) / denom]
}

export function formatMirrorReport(report: MirrorReport): string {
  const lines = [
    '=== Mirrored-deal report ===',
    `Pairs: ${report.pairs}  (1–1 pair ties: ${report.pairTies} — expected under deal luck)`,
    // Primary skill signal: each deal played on both seats
    `Challenger game win rate (primary): ${(report.challengerGameWinRate * 100).toFixed(1)}%`,
    `Mean challenger point margin / pair: ${report.meanChallengerPointMargin.toFixed(2)}`,
    // Secondary: sweeps only (most pairs split 1–1)
    `Pair sweeps: challenger ${report.challengerPairWins} / opponent ${report.opponentPairWins}` +
      ` (sweep rate excl. ties: ${(report.challengerPairWinRate * 100).toFixed(1)}%` +
      (report.pairWinRateCi95
        ? `, 95% CI [${(report.pairWinRateCi95[0] * 100).toFixed(1)}%, ${(report.pairWinRateCi95[1] * 100).toFixed(1)}%]`
        : '') +
      ')',
    `  (${report.note})`,
  ]
  return lines.join('\n')
}
