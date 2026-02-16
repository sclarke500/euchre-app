import { Spades, type SpadesBid, type StandardCard, type SpadesGameState } from '@67cards/shared'
import type { SpadesGamePlayer } from './types.js'
import { toSpadesPlayer } from './state.js'

interface ComputeSpadesAIBidParams {
  player: SpadesGamePlayer
  gameState: SpadesGameState
}

export function computeSpadesAIBid({ player, gameState }: ComputeSpadesAIBidParams): SpadesBid {
  return Spades.chooseSpadesBid(toSpadesPlayer(player), gameState)
}

interface ComputeSpadesAIPlayParams {
  player: SpadesGamePlayer
  gameState: SpadesGameState
}

export function computeSpadesAIPlay({ player, gameState }: ComputeSpadesAIPlayParams): StandardCard {
  return Spades.chooseSpadesCard(toSpadesPlayer(player), gameState)
}
