import type { Bid, Card, Round } from '@67cards/shared'
import {
  GamePhase,
  makeAIBidRound1,
  makeAIBidRound1Hard,
  makeAIBidRound2,
  makeAIBidRound2Hard,
  chooseCardToPlay,
  chooseCardToPlayHard,
  isPartnerWinning,
  isPartnerWinningHard,
  type GameTracker,
} from '@67cards/shared'
import type { GamePlayer } from './types.js'

export type EuchreAIAction =
  | { type: 'bid'; bid: Bid }
  | { type: 'play'; card: Card }
  | { type: 'none' }

interface ComputeEuchreAIActionParams {
  phase: GamePhase
  currentRound: Round | null
  player: GamePlayer
  aiDifficulty: 'easy' | 'hard'
  aiTracker: GameTracker | null
}

export function computeEuchreAIAction({
  phase,
  currentRound,
  player,
  aiDifficulty,
  aiTracker,
}: ComputeEuchreAIActionParams): EuchreAIAction {
  if (!currentRound) {
    return { type: 'none' }
  }

  const aiPlayer = {
    id: player.seatIndex,
    name: player.name,
    hand: player.hand,
    isHuman: false,
    teamId: player.teamId,
  }

  if (phase === GamePhase.BiddingRound1) {
    if (!currentRound.turnUpCard) {
      return { type: 'none' }
    }

    const bid =
      aiDifficulty === 'hard'
        ? makeAIBidRound1Hard(aiPlayer, currentRound.turnUpCard, currentRound.dealer)
        : makeAIBidRound1(aiPlayer, currentRound.turnUpCard, currentRound.dealer)

    return { type: 'bid', bid }
  }

  if (phase === GamePhase.BiddingRound2) {
    if (!currentRound.turnUpCard) {
      return { type: 'none' }
    }

    const bid =
      aiDifficulty === 'hard'
        ? makeAIBidRound2Hard(aiPlayer, currentRound.turnUpCard.suit, currentRound.dealer)
        : makeAIBidRound2(aiPlayer, currentRound.turnUpCard.suit, currentRound.dealer)

    return { type: 'bid', bid }
  }

  if (phase === GamePhase.Playing && currentRound.trump) {
    let card: Card

    if (aiDifficulty === 'hard' && aiTracker) {
      const partnerWinning = isPartnerWinningHard(
        currentRound.currentTrick,
        player.seatIndex,
        currentRound.trump.suit
      )
      // Check if THIS AI is going alone (they called trump + goingAlone)
      const isGoingAlone = currentRound.goingAlone && 
        currentRound.trump.calledBy === player.seatIndex
      card = chooseCardToPlayHard(
        aiPlayer,
        currentRound.currentTrick,
        currentRound.trump.suit,
        partnerWinning,
        aiTracker,
        isGoingAlone
      )
    } else {
      const partnerWinning = isPartnerWinning(
        currentRound.currentTrick,
        player.seatIndex,
        currentRound.trump.suit
      )
      card = chooseCardToPlay(
        aiPlayer,
        currentRound.currentTrick,
        currentRound.trump.suit,
        partnerWinning
      )
    }

    return { type: 'play', card }
  }

  return { type: 'none' }
}
