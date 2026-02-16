import { Spades, SpadesPhase, type SpadesTrick, type StandardCard } from '@67cards/shared'

export interface SpadesTurnOptions {
  actions: string[]
  cards?: string[]
}

interface BuildSpadesTurnOptionsParams {
  phase: SpadesPhase
  hand?: StandardCard[]
  currentTrick: SpadesTrick
  spadesBroken: boolean
}

export function buildSpadesTurnOptions({
  phase,
  hand,
  currentTrick,
  spadesBroken,
}: BuildSpadesTurnOptionsParams): SpadesTurnOptions {
  if (phase === SpadesPhase.Bidding) {
    return { actions: ['bid'] }
  }

  if (phase === SpadesPhase.Playing && hand) {
    const legalPlays = Spades.getLegalPlays(hand, currentTrick, spadesBroken)
    return { actions: ['play'], cards: legalPlays.map((card) => card.id) }
  }

  return { actions: [] }
}
