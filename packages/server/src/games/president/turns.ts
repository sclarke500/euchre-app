import { findValidPlays, type PresidentPile, type StandardCard } from '@67cards/shared'

export interface PresidentTurnOptions {
  validActions: string[]
  validPlayIds: string[][]
}

interface BuildPresidentTurnOptionsParams {
  hand: StandardCard[]
  currentPile: PresidentPile
  superTwosMode: boolean
}

export function buildPresidentTurnOptions({
  hand,
  currentPile,
  superTwosMode,
}: BuildPresidentTurnOptionsParams): PresidentTurnOptions {
  const validPlays = findValidPlays(hand, currentPile, superTwosMode)
  const canPass = currentPile.currentRank !== null

  const validActions: string[] = []
  if (validPlays.length > 0) validActions.push('play')
  if (canPass) validActions.push('pass')

  const validPlayIds = validPlays.map((play) => play.map((card) => card.id))

  return {
    validActions,
    validPlayIds,
  }
}
