/**
 * Multiplayer card-exchange host shell.
 * Rules live in pure shared confirmExchange / initCardExchange (via startNewRound).
 * This controller only: prompt humans, auto-confirm AI, emit events after pure swaps.
 */

import {
  PresidentPhase,
  chooseCardsToGiveBack,
  confirmExchange,
  type PresidentGameState,
  type StandardCard,
} from '@67cards/shared'
import type { PresidentGameEvents, PresidentGamePlayer } from './types.js'

interface PresidentCardExchangeDeps {
  players: PresidentGamePlayer[]
  getPhase: () => PresidentPhase
  /** Build pure state snapshot (must include exchangeParticipants). */
  toPureState: () => PresidentGameState
  /** Apply pure state back onto host. */
  applyPureState: (state: PresidentGameState) => void
  setPhase: (phase: PresidentPhase) => void
  setCurrentPlayer: (seatIndex: number) => void
  broadcastState: () => void
  processCurrentTurn: () => void
  events: Pick<PresidentGameEvents, 'onExchangePrompt' | 'onExchangeComplete'>
}

export function createPresidentCardExchangeController(deps: PresidentCardExchangeDeps) {
  /**
   * After pure startNewRound leaves phase CardExchange with participants filled,
   * prompt humans and auto-confirm AI.
   */
  function startExchange(): void {
    const pure = deps.toPureState()
    if (pure.phase !== PresidentPhase.CardExchange) {
      // No exchange this round
      deps.processCurrentTurn()
      return
    }

    deps.broadcastState()

    const participants = pure.exchangeParticipants ?? []
    if (participants.length === 0) {
      deps.processCurrentTurn()
      return
    }

    for (const info of participants) {
      const player = deps.players[info.seatId]
      if (!player) continue

      const partner = deps.players[info.partnerSeatId]

      if (player.isHuman && player.odusId) {
        deps.events.onExchangePrompt(player.odusId, {
          canSelect: info.canSelect,
          cardsNeeded: info.cardsNeeded,
          preSelectedCardIds: info.canSelect ? [] : info.cardIds,
          recipientName: partner?.name ?? 'opponent',
        })
      } else if (!player.isHuman) {
        setTimeout(() => {
          const cards = info.canSelect
            ? chooseCardsToGiveBack(
                {
                  id: player.seatIndex,
                  name: player.name,
                  hand: player.hand,
                  isHuman: false,
                  rank: player.rank,
                  finishOrder: player.finishOrder,
                  cardsToGive: player.cardsToGive,
                  cardsToReceive: player.cardsToReceive,
                },
                info.cardsNeeded
              ).map(c => c.id)
            : info.cardIds
          confirmExchangeSeat(info.seatId, cards)
        }, 300)
      }
    }
  }

  function confirmExchangeSeat(seatIndex: number, cardIds: string[]): boolean {
    if (deps.getPhase() !== PresidentPhase.CardExchange) return false

    const prev = deps.toPureState()
    const part = prev.exchangeParticipants?.find(p => p.seatId === seatIndex)
    if (!part || part.confirmed) return false

    const next = confirmExchange(prev, seatIndex, cardIds)
    if (next === prev) return false

    const wasExchange = prev.phase === PresidentPhase.CardExchange
    deps.applyPureState(next)

    // Notify humans of results when swaps complete
    if (next.phase === PresidentPhase.Playing && wasExchange) {
      for (const player of deps.players) {
        if (!player.isHuman || !player.odusId) continue
        const gave = next.pendingExchanges
          .filter(e => e.fromPlayerId === player.seatIndex)
          .flatMap(e => e.cards)
        const received = next.pendingExchanges
          .filter(e => e.toPlayerId === player.seatIndex)
          .flatMap(e => e.cards)
        if (gave.length > 0 || received.length > 0) {
          deps.events.onExchangeComplete(player.odusId, gave, received)
        }
      }

      deps.broadcastState()
      setTimeout(() => {
        deps.processCurrentTurn()
      }, 1500)
      return true
    }

    deps.broadcastState()
    return true
  }

  function getExchangeInfo(seatIndex: number) {
    const pure = deps.toPureState()
    const p = pure.exchangeParticipants?.find(x => x.seatId === seatIndex)
    if (!p) return undefined
    return {
      seatIndex: p.seatId,
      canSelect: p.canSelect,
      cardsNeeded: p.cardsNeeded,
      preSelectedCards: p.cardIds
        .map(id => deps.players[p.seatId]?.hand.find(c => c.id === id))
        .filter((c): c is StandardCard => !!c),
      recipientSeat: p.partnerSeatId,
      confirmed: p.confirmed,
    }
  }

  function isParticipating(seatIndex: number): boolean {
    return !!deps.toPureState().exchangeParticipants?.some(p => p.seatId === seatIndex)
  }

  function hasConfirmed(seatIndex: number): boolean {
    return !!deps.toPureState().exchangeParticipants?.find(p => p.seatId === seatIndex)?.confirmed
  }

  return {
    startExchange,
    confirmExchange: confirmExchangeSeat,
    getExchangeInfo,
    isParticipating,
    hasConfirmed,
  }
}
