/**
 * Headless multi-policy Euchre runner.
 * - Seeded deal via shared dealRound(rng)
 * - Per-seat GameTracker for hard / noisy_hard (never getTracker())
 * - legalEuchreActions → policy.choose → applyEuchreAction
 * - Same-ref illegal → one random-legal retry labeled noise
 */
import {
  applyEuchreAction,
  calculateRoundScore,
  continueAfterTrick,
  createEuchreGame,
  dealRound,
  euchreActionKey,
  GamePhase,
  GameTracker,
  legalEuchreActions,
  startBiddingRound1,
  startNextRound,
  type EuchreAction,
  type EuchreGameState,
  type EuchreRules,
} from '@67cards/shared'
import { encodeEuchreObservation } from '../encode/euchre.js'
import {
  createEuchrePolicy,
  DEFAULT_MIX,
  labelQualityFor,
  sampleMix,
  type MixSpec,
} from '../policies/euchre.js'
import { deriveSeed, mulberry32, uniformPick } from '../rng.js'
import type { GameStats, PolicyId, Step } from '../types.js'
import { JsonlWriter } from '../write/jsonl.js'

export interface EuchreRunOptions {
  games: number
  seed: number
  epsilon: number
  /** Fixed seat policies; if set, overrides mix sampling. */
  policies?: [PolicyId, PolicyId, PolicyId, PolicyId]
  mix?: MixSpec
  rules?: Partial<EuchreRules>
  outPath?: string | null
  onGame?: (stats: GameStats, gameIndex: number) => void
  /** Safety cap for steps per game (default generous). */
  maxStepsPerGame?: number
}

export interface EuchreRunResult {
  stats: GameStats[]
  stepsWritten: number
}

const DECISION_PHASES = new Set([
  GamePhase.BiddingRound1,
  GamePhase.BiddingRound2,
  GamePhase.DealerDiscard,
  GamePhase.Playing,
])

function needsHardTracker(id: PolicyId): boolean {
  return id === 'hard' || id === 'noisy_hard'
}

export async function runEuchreSim(opts: EuchreRunOptions): Promise<EuchreRunResult> {
  const mix = opts.mix ?? DEFAULT_MIX
  const maxSteps = opts.maxStepsPerGame ?? 5000
  const writer = new JsonlWriter(opts.outPath ?? null)
  writer.writeHeader({
    schemaVersion: 1,
    game: 'euchre',
    mixId: opts.policies ? `fixed:${opts.policies.join(',')}` : mix.id,
    epsilon: opts.epsilon,
    seed: opts.seed,
    games: opts.games,
    rules: {
      stickTheDealer: opts.rules?.stickTheDealer ?? false,
      canadianLoner: opts.rules?.canadianLoner ?? false,
    },
    createdAt: new Date().toISOString(),
  })

  const mixRng = mulberry32(opts.seed)
  const stats: GameStats[] = []
  let stepsWritten = 0

  for (let gi = 0; gi < opts.games; gi++) {
    const gameSeed = deriveSeed(opts.seed, gi)
    const rng = mulberry32(gameSeed)
    const policyIds = opts.policies ?? sampleMix(mix, mixRng)
    const policies = policyIds.map(id => createEuchrePolicy(id, opts.epsilon))

    // E4: per-seat trackers for hard seats only
    const trackers: (GameTracker | null)[] = policyIds.map(id =>
      needsHardTracker(id) ? new GameTracker() : null
    )

    const result = playOneGame({
      gameIndex: gi,
      seed: gameSeed,
      rng,
      policyIds,
      policies,
      trackers,
      rules: opts.rules ?? {},
      maxSteps,
    })

    writer.writeSteps(result.steps)
    stepsWritten += result.steps.length
    stats.push(result.stats)
    opts.onGame?.(result.stats, gi)
  }

  await writer.close()
  return { stats, stepsWritten }
}

interface PlayArgs {
  gameIndex: number
  seed: number
  rng: () => number
  policyIds: PolicyId[]
  policies: ReturnType<typeof createEuchrePolicy>[]
  trackers: (GameTracker | null)[]
  rules: Partial<EuchreRules>
  maxSteps: number
}

function playOneGame(args: PlayArgs): { steps: Step[]; stats: GameStats } {
  const { gameIndex, seed, rng, policyIds, policies, trackers, rules, maxSteps } = args
  const gameId = `euchre-${seed}-${gameIndex}`

  let state = createEuchreGame(['P0', 'P1', 'P2', 'P3'], -1, rules)
  state = {
    ...state,
    players: state.players.map(p => ({ ...p, isHuman: false })),
  }
  state = dealRound(state, rng)
  state = startBiddingRound1(state)
  resetTrackers(trackers)

  const steps: Step[] = []
  let stepIndex = 0
  let handIndex = 0
  let aloneHands = 0
  let pointsSum = 0
  let scoredHands = 0
  let fallbackCount = 0
  // Buffer indices of steps in current hand for handDelta backfill
  let handStepStart = 0
  let scoresAtHandStart: [number, number] = [0, 0]

  let guard = 0
  while (!state.gameOver && guard++ < maxSteps) {
    // Non-decision transitions
    if (state.phase === GamePhase.Dealing) {
      state = startBiddingRound1(state)
      resetTrackers(trackers)
      continue
    }

    if (state.phase === GamePhase.TrickComplete) {
      const last = state.currentRound?.tricks[state.currentRound.tricks.length - 1]
      if (last) {
        for (const t of trackers) {
          if (t) t.recordTrick(last)
        }
      }
      // 5th trick already scored inside applyPlay → RoundComplete/GameOver
      if (
        state.phase === GamePhase.TrickComplete &&
        (state.currentRound?.tricks.length ?? 0) < 5
      ) {
        state = continueAfterTrick(state)
      }
      continue
    }

    if (state.phase === GamePhase.RoundComplete) {
      const alone = state.currentRound?.goingAlone
      if (alone) aloneHands++
      const delta = handDelta(state, scoresAtHandStart)
      pointsSum += delta[0]! + delta[1]!
      scoredHands++
      backfillHand(steps, handStepStart, delta)
      handIndex++
      handStepStart = steps.length
      scoresAtHandStart = [
        state.scores[0]?.score ?? 0,
        state.scores[1]?.score ?? 0,
      ]
      state = startNextRound(state, rng)
      // startNextRound deals; phase Dealing
      resetTrackers(trackers)
      continue
    }

    if (state.phase === GamePhase.GameOver) {
      break
    }

    if (!DECISION_PHASES.has(state.phase)) {
      // Setup or unknown — abort
      break
    }

    const seat = state.currentRound!.currentPlayer
    const legal = legalEuchreActions(state, seat)
    if (legal.length === 0) {
      // Stuck — should not happen
      break
    }

    // Keep trackers aware of trump (idempotent)
    if (state.currentRound?.trump) {
      for (const t of trackers) {
        if (t) t.setTrump(state.currentRound.trump.suit)
      }
    }

    const policy = policies[seat]!
    const policyId = policyIds[seat]!
    const tracker = trackers[seat]
    let chooseResult = policy.choose({
      state,
      seat,
      legal,
      rng,
      tracker: tracker ?? undefined,
    })
    let action = chooseResult.action
    let exploratory = chooseResult.exploratory
    let labelQuality = labelQualityFor(policyId, exploratory)

    // Ensure chosen action is in legal set; if not, treat as bug → random legal noise
    if (!legal.some(a => euchreActionKey(a) === euchreActionKey(action))) {
      action = uniformPick(legal, rng)
      exploratory = true
      labelQuality = 'noise'
      fallbackCount++
    }

    const observation = encodeEuchreObservation(state, seat, legal)
    const phaseBefore = state.phase
    let next = applyEuchreAction(state, seat, action)

    // Same-ref illegal → one random legal retry as noise
    if (next === state) {
      const fallback = uniformPick(legal, rng)
      action = fallback
      exploratory = true
      labelQuality = 'noise'
      fallbackCount++
      next = applyEuchreAction(state, seat, fallback)
      if (next === state) {
        // Still stuck — abort game
        break
      }
    }

    if (next.currentRound?.trump) {
      for (const t of trackers) {
        if (t) t.setTrump(next.currentRound.trump.suit)
      }
    }

    steps.push({
      schemaVersion: 1,
      game: 'euchre',
      gameId,
      seed,
      gameIndex,
      handIndex,
      stepIndex: stepIndex++,
      seat,
      phase: phaseBefore,
      observation,
      legalActions: legal,
      action,
      policyId,
      exploratory,
      labelQuality,
    })

    state = next
  }

  // Game over path: finishRound already applied scores
  if (state.phase === GamePhase.GameOver || state.gameOver) {
    const alone = state.currentRound?.goingAlone
    if (alone) aloneHands++
    const delta = handDelta(state, scoresAtHandStart)
    pointsSum += delta[0]! + delta[1]!
    scoredHands++
    backfillHand(steps, handStepStart, delta)
  }

  const finalScores: [number, number] = [
    state.scores[0]?.score ?? 0,
    state.scores[1]?.score ?? 0,
  ]
  const finalWinner = state.winner
  for (const s of steps) {
    s.finalScores = finalScores
    s.finalWinner = finalWinner
  }

  const stats: GameStats = {
    gameIndex,
    seed,
    winner: finalWinner,
    finalScores,
    hands: scoredHands,
    steps: steps.length,
    aloneHands,
    pointsPerHand: scoredHands > 0 ? pointsSum / scoredHands : 0,
    policyIds: policyIds as [PolicyId, PolicyId, PolicyId, PolicyId],
    fallbackCount,
  }

  return { steps, stats }
}

function handDelta(
  state: EuchreGameState,
  scoresAtHandStart: [number, number]
): [number, number] {
  // Prefer scoreboard delta (includes finishRound)
  const s0 = (state.scores[0]?.score ?? 0) - scoresAtHandStart[0]
  const s1 = (state.scores[1]?.score ?? 0) - scoresAtHandStart[1]
  if (s0 !== 0 || s1 !== 0) return [s0, s1]
  // Fallback: recompute from tricks if available
  if (state.currentRound?.trump && state.currentRound.tricks.length >= 5) {
    try {
      const rs = calculateRoundScore(state.currentRound.tricks, state.currentRound.trump)
      return [rs.team0Points, rs.team1Points]
    } catch {
      return [0, 0]
    }
  }
  return [0, 0]
}

function backfillHand(steps: Step[], from: number, delta: [number, number]): void {
  for (let i = from; i < steps.length; i++) {
    steps[i]!.handDelta = delta
  }
}

function resetTrackers(trackers: (GameTracker | null)[]): void {
  for (const t of trackers) {
    if (t) t.reset()
  }
}
