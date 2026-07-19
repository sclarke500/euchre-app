/**
 * Imperfect-info observation encoder for Euchre steps.
 * Includes only what the acting seat can legally know (no opponent hands / buried kitty).
 */
import type { EuchreAction, EuchreGameState } from '@67cards/shared'
import { GamePhase } from '@67cards/shared'

export function encodeEuchreObservation(
  state: EuchreGameState,
  seat: number,
  legal: EuchreAction[]
): Record<string, unknown> {
  const round = state.currentRound
  const me = state.players[seat]

  return {
    seat,
    phase: state.phase,
    scores: state.scores.map(s => s.score),
    gameOver: state.gameOver,
    winner: state.winner,
    rules: {
      stickTheDealer: state.rules.stickTheDealer,
      canadianLoner: state.rules.canadianLoner,
    },
    dealer: round?.dealer ?? null,
    passCount: state.passCount,
    biddingRound: round?.biddingRound ?? null,
    currentPlayer: round?.currentPlayer ?? null,
    turnUpCard: round?.turnUpCard
      ? { id: round.turnUpCard.id, suit: round.turnUpCard.suit, rank: round.turnUpCard.rank }
      : null,
    trump: round?.trump
      ? {
          suit: round.trump.suit,
          calledBy: round.trump.calledBy,
          goingAlone: round.trump.goingAlone,
        }
      : null,
    goingAlone: round?.goingAlone ?? false,
    alonePlayer: round?.alonePlayer ?? null,
    // Own hand only
    hand: (me?.hand ?? []).map(c => ({ id: c.id, suit: c.suit, rank: c.rank })),
    // Public current trick
    currentTrick: (round?.currentTrick.cards ?? []).map(pc => ({
      playerId: pc.playerId,
      card: { id: pc.card.id, suit: pc.card.suit, rank: pc.card.rank },
    })),
    leadingSuit: round?.currentTrick.leadingSuit ?? null,
    // Completed tricks (public) — compact: winners + cards only (no nested bloat)
    // Full history needed for void inference offline; keep cards, drop redundancy later if size bites.
    completedTricks: (round?.tricks ?? []).map(t => ({
      winnerId: t.winnerId,
      leadingSuit: t.leadingSuit,
      cards: t.cards.map(pc => ({
        playerId: pc.playerId,
        cardId: pc.card.id,
      })),
    })),
    // Hands sizes (public knowledge of count only)
    handSizes: state.players.map(p => p.hand.length),
    legalActionCount: legal.length,
    // Phase hint for trainers (no private data)
    isDecisionPhase: [
      GamePhase.BiddingRound1,
      GamePhase.BiddingRound2,
      GamePhase.DealerDiscard,
      GamePhase.Playing,
    ].includes(state.phase),
  }
}
