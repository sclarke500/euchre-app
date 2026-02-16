import { BidAction, GamePhase, getLegalPlays, type Round, type Card } from '@67cards/shared'
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
}

export function buildEuchreTurnOptions({
  playerIndex,
  player,
  phase,
  currentDealer,
  passCount,
  currentRound,
}: BuildEuchreTurnOptionsParams): EuchreTurnOptions {
  let validActions: string[] = []
  let validCards: string[] | undefined

  if (phase === GamePhase.BiddingRound1) {
    validActions =
      playerIndex === currentDealer
        ? [BidAction.PickUp, BidAction.Pass]
        : [BidAction.OrderUp, BidAction.Pass]
  } else if (phase === GamePhase.BiddingRound2) {
    if (playerIndex === currentDealer && passCount >= 3) {
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
