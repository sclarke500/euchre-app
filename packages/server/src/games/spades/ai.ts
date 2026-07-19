import {
  Spades,
  chooseSpadesBidHard,
  chooseSpadesCardHard,
  type SpadesBid,
  type StandardCard,
  type SpadesGameState,
  type SpadesTracker,
} from '@67cards/shared'
import type { SpadesGamePlayer } from './types.js'
import { toSpadesPlayer } from './state.js'

interface ComputeSpadesAIBidParams {
  player: SpadesGamePlayer
  gameState: SpadesGameState
  difficulty?: 'easy' | 'hard'
}

export function computeSpadesAIBid({
  player,
  gameState,
  difficulty = 'easy',
}: ComputeSpadesAIBidParams): SpadesBid {
  const p = toSpadesPlayer(player)
  return difficulty === 'hard'
    ? chooseSpadesBidHard(p, gameState)
    : Spades.chooseSpadesBid(p, gameState)
}

interface ComputeSpadesAIPlayParams {
  player: SpadesGamePlayer
  gameState: SpadesGameState
  difficulty?: 'easy' | 'hard'
  tracker?: SpadesTracker | null
}

export function computeSpadesAIPlay({
  player,
  gameState,
  difficulty = 'easy',
  tracker = null,
}: ComputeSpadesAIPlayParams): StandardCard {
  const p = toSpadesPlayer(player)
  if (difficulty === 'hard' && tracker) {
    return chooseSpadesCardHard(p, gameState, tracker)
  }
  return Spades.chooseSpadesCard(p, gameState)
}
