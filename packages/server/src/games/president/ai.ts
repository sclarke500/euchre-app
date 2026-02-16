import type {
  PresidentGameState,
  PresidentPile,
  PresidentPlayer,
  StandardCard,
} from '@67cards/shared'
import { choosePresidentPlay, choosePresidentPlayHard } from '@67cards/shared'
import type { PresidentGamePlayer } from './types.js'

export function toPresidentAIPlayer(player: PresidentGamePlayer): PresidentPlayer {
  return {
    id: player.seatIndex,
    name: player.name,
    hand: player.hand,
    isHuman: false,
    rank: player.rank,
    finishOrder: player.finishOrder,
    cardsToGive: player.cardsToGive,
    cardsToReceive: player.cardsToReceive,
  }
}

interface ComputePresidentAIPlayParams {
  player: PresidentGamePlayer
  currentPile: PresidentPile
  gameState: PresidentGameState
  aiDifficulty: 'easy' | 'hard'
}

export function computePresidentAIPlay({
  player,
  currentPile,
  gameState,
  aiDifficulty,
}: ComputePresidentAIPlayParams): StandardCard[] | null {
  const presidentPlayer = toPresidentAIPlayer(player)

  return aiDifficulty === 'hard'
    ? choosePresidentPlayHard(presidentPlayer, currentPile, gameState)
    : choosePresidentPlay(presidentPlayer, currentPile, gameState)
}
