import {
  BidAction,
  GamePhase,
  getLegalPlays,
  type Round,
  type Card,
  type EuchreRules,
  DEFAULT_EUCHRE_RULES,
} from '@67cards/shared'
import type { GamePlayer } from './types.js'

export interface EuchreTurnOptions {
  validActions: string[]
  validCards: string[] | undefined
}

interface BuildEuchreTurnOptionsParams {
  playerIndex: number
  player: GamePlayer
  phase: GamePhase
  currentDealer: number
  passCount: number
  currentRound: Round | null
  /** Must match pure state.rules so UI and machine agree */
  rules?: EuchreRules
}

export function buildEuchreTurnOptions({
  playerIndex,
  player,
  phase,
  currentDealer,
  passCount,
  currentRound,
  rules = DEFAULT_EUCHRE_RULES,
}: BuildEuchreTurnOptionsParams): EuchreTurnOptions {
  let validActions: string[] = []
  let validCards: string[] | undefined

  if (phase === GamePhase.BiddingRound1) {
    validActions =
      playerIndex === currentDealer
        ? [BidAction.PickUp, BidAction.Pass]
        : [BidAction.OrderUp, BidAction.Pass]
  } else if (phase === GamePhase.BiddingRound2) {
    // Stick-the-dealer: dealer with 3 prior passes must call. Can-pass: dealer may Pass → redeal.
    if (rules.stickTheDealer && playerIndex === currentDealer && passCount >= 3) {
      validActions = [BidAction.CallTrump]
    } else {
      validActions = [BidAction.CallTrump, BidAction.Pass]
    }
  } else if (phase === GamePhase.Playing && currentRound?.trump) {
    validActions = ['play_card']
    const legalPlays: Card[] = getLegalPlays(
      player.hand,
      currentRound.currentTrick,
      currentRound.trump.suit
    )
    validCards = legalPlays.map((card) => card.id)
  } else if (phase === GamePhase.DealerDiscard) {
    validActions = ['discard']
    validCards = player.hand.map((card) => card.id)
  }

  return { validActions, validCards }
}
