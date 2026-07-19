/**
 * Privileged built-in Euchre policies (full pure state, same as product).
 * Never call getTracker() — trackers are constructed per hard seat by the runner.
 */
import {
  BidAction,
  type EuchreAction,
  type EuchreGameState,
  type GameTracker,
  type Suit,
  makeAIBidRound1,
  makeAIBidRound2,
  makeAIBidRound1Hard,
  makeAIBidRound2Hard,
  chooseCardToPlay,
  chooseCardToPlayHard,
  chooseDealerDiscard,
  chooseDealerDiscardHard,
  isPartnerWinning,
  isPartnerWinningHard,
  GamePhase,
} from '@67cards/shared'
import type { BuiltinPolicy, BuiltinPolicyContext, PolicyId } from '../types.js'
import { uniformPick } from '../rng.js'
import { noisyPolicy } from './noisy.js'

function bidToAction(bid: {
  action: BidAction
  suit?: Suit
  goingAlone?: boolean
}): EuchreAction {
  switch (bid.action) {
    case BidAction.Pass:
      return { kind: 'pass' }
    case BidAction.OrderUp:
      return { kind: 'order_up', goingAlone: !!bid.goingAlone }
    case BidAction.PickUp:
      return { kind: 'pick_up', goingAlone: !!bid.goingAlone }
    case BidAction.CallTrump:
      if (!bid.suit) throw new Error('CallTrump missing suit')
      return {
        kind: 'call_trump',
        suit: bid.suit,
        goingAlone: !!bid.goingAlone,
      }
    default:
      throw new Error(`Unexpected bid action: ${bid.action}`)
  }
}

/** Map product Bid to legal EuchreAction; if missing from legal, fall back (caller handles). */
function matchLegal(preferred: EuchreAction, legal: EuchreAction[]): EuchreAction | null {
  const key = actionKey(preferred)
  return legal.find(a => actionKey(a) === key) ?? null
}

function actionKey(a: EuchreAction): string {
  switch (a.kind) {
    case 'pass':
      return 'pass'
    case 'order_up':
      return `order_up:${a.goingAlone ? 1 : 0}`
    case 'pick_up':
      return `pick_up:${a.goingAlone ? 1 : 0}`
    case 'call_trump':
      return `call_trump:${a.suit}:${a.goingAlone ? 1 : 0}`
    case 'discard':
      return `discard:${a.cardId}`
    case 'play':
      return `play:${a.cardId}`
  }
}

type Ctx = BuiltinPolicyContext<EuchreGameState, EuchreAction>

function chooseEasy(ctx: Ctx): EuchreAction {
  const { state, seat, legal } = ctx
  if (legal.length === 0) throw new Error('easy: no legal actions')
  const player = state.players[seat]!
  const round = state.currentRound!

  if (state.phase === GamePhase.BiddingRound1) {
    const bid = makeAIBidRound1(player, round.turnUpCard!, round.dealer)
    const preferred = bidToAction(bid)
    return matchLegal(preferred, legal) ?? legal[0]!
  }

  if (state.phase === GamePhase.BiddingRound2) {
    const bid = makeAIBidRound2(
      player,
      round.turnUpCard!.suit,
      round.dealer,
      state.rules.stickTheDealer
    )
    const preferred = bidToAction(bid)
    return matchLegal(preferred, legal) ?? legal[0]!
  }

  if (state.phase === GamePhase.DealerDiscard) {
    const card = chooseDealerDiscard(player.hand, round.trump!.suit)
    const preferred: EuchreAction = { kind: 'discard', cardId: card.id }
    return matchLegal(preferred, legal) ?? legal[0]!
  }

  if (state.phase === GamePhase.Playing) {
    const partnerWinning = isPartnerWinning(
      round.currentTrick,
      seat,
      round.trump!.suit
    )
    const card = chooseCardToPlay(
      player,
      round.currentTrick,
      round.trump!.suit,
      partnerWinning
    )
    const preferred: EuchreAction = { kind: 'play', cardId: card.id }
    return matchLegal(preferred, legal) ?? legal[0]!
  }

  return legal[0]!
}

function chooseHard(ctx: Ctx): EuchreAction {
  const { state, seat, legal, tracker } = ctx
  if (legal.length === 0) throw new Error('hard: no legal actions')
  const player = state.players[seat]!
  const round = state.currentRound!
  const gt = tracker as GameTracker | undefined

  if (state.phase === GamePhase.BiddingRound1) {
    const bid = makeAIBidRound1Hard(player, round.turnUpCard!, round.dealer)
    const preferred = bidToAction(bid)
    return matchLegal(preferred, legal) ?? legal[0]!
  }

  if (state.phase === GamePhase.BiddingRound2) {
    const bid = makeAIBidRound2Hard(
      player,
      round.turnUpCard!.suit,
      round.dealer,
      state.rules.stickTheDealer
    )
    const preferred = bidToAction(bid)
    return matchLegal(preferred, legal) ?? legal[0]!
  }

  if (state.phase === GamePhase.DealerDiscard) {
    const card = chooseDealerDiscardHard(player.hand, round.trump!.suit)
    const preferred: EuchreAction = { kind: 'discard', cardId: card.id }
    return matchLegal(preferred, legal) ?? legal[0]!
  }

  if (state.phase === GamePhase.Playing) {
    if (!gt) {
      // Fallback to easy play path if tracker missing (should not happen)
      return chooseEasy(ctx)
    }
    const partnerWinning = isPartnerWinningHard(
      round.currentTrick,
      seat,
      round.trump!.suit
    )
    const card = chooseCardToPlayHard(
      player,
      round.currentTrick,
      round.trump!.suit,
      partnerWinning,
      gt,
      round.goingAlone
    )
    const preferred: EuchreAction = { kind: 'play', cardId: card.id }
    return matchLegal(preferred, legal) ?? legal[0]!
  }

  return legal[0]!
}

export const easyPolicy: BuiltinPolicy<EuchreGameState, EuchreAction> = {
  id: 'easy',
  choose(ctx) {
    return { action: chooseEasy(ctx), exploratory: false }
  },
}

export const hardPolicy: BuiltinPolicy<EuchreGameState, EuchreAction> = {
  id: 'hard',
  choose(ctx) {
    return { action: chooseHard(ctx), exploratory: false }
  },
}

export const randomLegalPolicy: BuiltinPolicy<EuchreGameState, EuchreAction> = {
  id: 'random_legal',
  choose(ctx) {
    if (ctx.legal.length === 0) throw new Error('random_legal: no legal actions')
    return { action: uniformPick(ctx.legal, ctx.rng), exploratory: true }
  },
}

export function createEuchrePolicy(
  id: PolicyId,
  epsilon: number
): BuiltinPolicy<EuchreGameState, EuchreAction> {
  switch (id) {
    case 'hard':
      return hardPolicy
    case 'easy':
      return easyPolicy
    case 'random_legal':
      return randomLegalPolicy
    case 'noisy_hard':
      return noisyPolicy(hardPolicy, epsilon, 'noisy_hard')
    case 'noisy_easy':
      return noisyPolicy(easyPolicy, epsilon, 'noisy_easy')
    default:
      throw new Error(`Unknown Euchre policy: ${id}`)
  }
}

/** Default mix fractions (§4.3). Cumulative thresholds over rng(). */
export type MixSpec = {
  id: string
  /** Each entry: weight + 4 seat policy ids */
  buckets: Array<{ weight: number; policies: [PolicyId, PolicyId, PolicyId, PolicyId] }>
}

export const DEFAULT_MIX: MixSpec = {
  id: 'default',
  buckets: [
    { weight: 0.3, policies: ['hard', 'hard', 'hard', 'hard'] },
    { weight: 0.25, policies: ['hard', 'easy', 'hard', 'easy'] },
    { weight: 0.2, policies: ['noisy_hard', 'noisy_hard', 'noisy_hard', 'noisy_hard'] },
    { weight: 0.15, policies: ['hard', 'easy', 'random_legal', 'hard'] },
    { weight: 0.1, policies: ['random_legal', 'random_legal', 'random_legal', 'random_legal'] },
  ],
}

export function sampleMix(
  mix: MixSpec,
  rng: () => number
): [PolicyId, PolicyId, PolicyId, PolicyId] {
  const r = rng()
  let acc = 0
  for (const b of mix.buckets) {
    acc += b.weight
    if (r < acc) return b.policies
  }
  return mix.buckets[mix.buckets.length - 1]!.policies
}

export function labelQualityFor(
  policyId: PolicyId,
  exploratory: boolean
): 'teacher' | 'exploratory' | 'noise' {
  if (exploratory) return 'noise'
  if (policyId === 'hard' || policyId === 'noisy_hard') return 'teacher'
  if (policyId === 'random_legal') return 'noise'
  // easy / noisy_easy non-ε
  return 'exploratory'
}
