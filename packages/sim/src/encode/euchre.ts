/**
 * Imperfect-info observation encoder for Euchre steps.
 * Includes only what the acting seat can legally know (no opponent hands / buried kitty).
 */
import type { EuchreAction, EuchreGameState } from '@67cards/shared'
import { GamePhase } from '@67cards/shared'

export type EncodeMode = 'full' | 'compact'

function cardRef(c: { id: string; suit: string; rank: string }) {
  return { id: c.id, suit: c.suit, rank: c.rank }
}

/**
 * Encode observation. `compact` drops fields unused by the S1.5 play IL features
 * and uses shorter card refs in tricks.
 */
export function encodeEuchreObservation(
  state: EuchreGameState,
  seat: number,
  legal: EuchreAction[],
  mode: EncodeMode = 'full'
): Record<string, unknown> {
  const round = state.currentRound
  const me = state.players[seat]
  const compact = mode === 'compact'

  const base: Record<string, unknown> = {
    seat,
    phase: state.phase,
    scores: state.scores.map(s => s.score),
    dealer: round?.dealer ?? null,
    trump: round?.trump
      ? {
          suit: round.trump.suit,
          calledBy: round.trump.calledBy,
          goingAlone: round.trump.goingAlone,
        }
      : null,
    goingAlone: round?.goingAlone ?? false,
    alonePlayer: round?.alonePlayer ?? null,
    hand: (me?.hand ?? []).map(c =>
      compact ? { id: c.id } : cardRef(c)
    ),
    currentTrick: (round?.currentTrick.cards ?? []).map(pc => ({
      playerId: pc.playerId,
      card: compact ? { id: pc.card.id } : cardRef(pc.card),
    })),
    leadingSuit: round?.currentTrick.leadingSuit ?? null,
    completedTricks: (round?.tricks ?? []).map(t => ({
      winnerId: t.winnerId,
      leadingSuit: t.leadingSuit,
      cards: t.cards.map(pc => ({
        playerId: pc.playerId,
        cardId: pc.card.id,
      })),
    })),
    handSizes: state.players.map(p => p.hand.length),
  }

  if (!compact) {
    base.gameOver = state.gameOver
    base.winner = state.winner
    base.rules = {
      stickTheDealer: state.rules.stickTheDealer,
      canadianLoner: state.rules.canadianLoner,
    }
    base.passCount = state.passCount
    base.biddingRound = round?.biddingRound ?? null
    base.currentPlayer = round?.currentPlayer ?? null
    base.turnUpCard = round?.turnUpCard
      ? cardRef(round.turnUpCard)
      : null
    base.legalActionCount = legal.length
    base.isDecisionPhase = [
      GamePhase.BiddingRound1,
      GamePhase.BiddingRound2,
      GamePhase.DealerDiscard,
      GamePhase.Playing,
    ].includes(state.phase)
  }

  return base
}

/** Compact a full step for play-teacher dumps (smaller JSONL). */
export function compactPlayTeacherStep(step: {
  schemaVersion: 1
  game: string
  gameId: string
  seed: number
  gameIndex: number
  handIndex: number
  stepIndex: number
  seat: number
  phase: string
  observation: Record<string, unknown>
  legalActions: unknown[]
  action: unknown
  policyId: string
  exploratory: boolean
  labelQuality: string
  handDelta?: number[]
  finalScores?: number[]
  finalWinner?: number | null
}): Record<string, unknown> {
  const legalCardIds = (step.legalActions as Array<{ kind?: string; cardId?: string }>)
    .filter(a => a.kind === 'play' && a.cardId)
    .map(a => a.cardId as string)

  const action = step.action as { kind?: string; cardId?: string }
  return {
    schemaVersion: step.schemaVersion,
    game: step.game,
    gameId: step.gameId,
    seed: step.seed,
    gameIndex: step.gameIndex,
    handIndex: step.handIndex,
    stepIndex: step.stepIndex,
    seat: step.seat,
    phase: step.phase,
    observation: step.observation,
    legalCardIds,
    action: action?.kind === 'play' ? { kind: 'play', cardId: action.cardId } : step.action,
    policyId: step.policyId,
    exploratory: step.exploratory,
    labelQuality: step.labelQuality,
    // omit finalScores/finalWinner/handDelta for size — not needed for play IL
  }
}
