/**
 * Headless AI-vs-AI smoke: pure engines complete without throwing.
 * Complements Playwright UI smoke.
 */
import { describe, it, expect } from 'vitest'
import {
  createSpadesGame,
  dealSpadesCards,
  processBid,
  startBiddingPhase,
} from '../spades/game.js'
import { playCard as spadesPlayCard, continuePlay } from '../spades/tricks.js'
import { chooseSpadesBid, chooseSpadesCard } from '../spades/ai.js'
import { SpadesPhase } from '../spades/types.js'
import {
  createEuchreGame,
  dealRound,
  startBiddingRound1,
  applyBid,
  applyDealerDiscard,
  applyPlay,
  continueAfterTrick,
} from '../euchre/game.js'
import { BidAction, GamePhase } from '../euchre/types.js'
import {
  makeAIBidRound1,
  makeAIBidRound2,
  chooseCardToPlay,
  chooseDealerDiscard,
  isPartnerWinning,
} from '../euchre/ai.js'
import {
  createPresidentGame,
  startNewRound,
  processPlay,
  processPass,
  confirmExchange,
  assignRanks,
} from '../president/game.js'
import { PresidentPhase } from '../president/types.js'
import {
  choosePresidentPlayHard,
  chooseCardsToGiveBack,
} from '../president/ai.js'

describe('headless AI smoke (pure engines)', () => {
  it('Spades: all-AI bids and plays at least one full trick', () => {
    let s = createSpadesGame(['A', 'B', 'C', 'D'], -1) // no human
    s = { ...s, dealer: 0, players: s.players.map(p => ({ ...p, isHuman: false })) }
    s = dealSpadesCards(s)
    s = startBiddingPhase(s)

    for (let i = 0; i < 4; i++) {
      const seat = s.currentPlayer
      const player = s.players[seat]!
      const bid = chooseSpadesBid(player, s)
      const next = processBid(s, seat, bid)
      expect(next).not.toBe(s)
      s = next
    }
    expect(s.phase).toBe(SpadesPhase.Playing)

    // Play one full trick (4 cards)
    for (let i = 0; i < 4; i++) {
      const seat = s.currentPlayer
      const player = s.players[seat]!
      const card = chooseSpadesCard(player, s)
      const next = spadesPlayCard(s, seat, card)
      expect(next).not.toBe(s)
      s = next
    }
    expect(s.completedTricks.length).toBe(1)
    if (s.phase === SpadesPhase.TrickComplete) {
      s = continuePlay(s)
      expect(s.phase).toBe(SpadesPhase.Playing)
    }
  })

  it('Euchre: all-AI reaches Playing and completes a trick', () => {
    let s = createEuchreGame(['A', 'B', 'C', 'D'], -1)
    s = {
      ...s,
      currentDealer: 0,
      players: s.players.map(p => ({ ...p, isHuman: false })),
    }
    s = dealRound(s, () => Math.random())
    s = startBiddingRound1(s)

    let guard = 0
    while (
      (s.phase === GamePhase.BiddingRound1 || s.phase === GamePhase.BiddingRound2) &&
      guard++ < 20
    ) {
      const seat = s.currentRound!.currentPlayer
      const player = s.players[seat]!
      const bid =
        s.phase === GamePhase.BiddingRound1
          ? makeAIBidRound1(player, s.currentRound!.turnUpCard!, s.currentRound!.dealer)
          : makeAIBidRound2(
              player,
              s.currentRound!.turnUpCard!.suit,
              s.currentRound!.dealer,
              s.rules.stickTheDealer
            )
      const next = applyBid(s, bid)
      // Passes always progress; rare stuck is OK to retry with force call later
      if (next === s && s.phase === GamePhase.BiddingRound2) {
        // stick or stuck — force call
        const forced = applyBid(s, {
          playerId: seat,
          action: BidAction.CallTrump,
          suit: 'hearts' as any,
        })
        if (forced !== s) s = forced
        else break
      } else {
        s = next
      }
      if (s.phase === GamePhase.Dealing) {
        s = startBiddingRound1(s)
      }
      if (s.phase === GamePhase.DealerDiscard) {
        const dealer = s.players[s.currentRound!.dealer]!
        const discard = chooseDealerDiscard(dealer.hand, s.currentRound!.trump!.suit)
        s = applyDealerDiscard(s, discard.id)
      }
    }

    expect([GamePhase.Playing, GamePhase.DealerDiscard]).toContain(s.phase)
    if (s.phase === GamePhase.DealerDiscard) {
      const dealer = s.players[s.currentRound!.dealer]!
      const discard = chooseDealerDiscard(dealer.hand, s.currentRound!.trump!.suit)
      s = applyDealerDiscard(s, discard.id)
    }
    expect(s.phase).toBe(GamePhase.Playing)

    // Play until trick complete (3 or 4 cards if alone)
    guard = 0
    while (s.phase === GamePhase.Playing && guard++ < 8) {
      const seat = s.currentRound!.currentPlayer
      const player = s.players[seat]!
      const partnerWinning = isPartnerWinning(
        s.currentRound!.currentTrick,
        seat,
        s.currentRound!.trump!.suit
      )
      const card = chooseCardToPlay(
        player,
        s.currentRound!.currentTrick,
        s.currentRound!.trump!.suit,
        partnerWinning
      )
      s = applyPlay(s, seat, card.id)
    }
    expect(s.phase).toBe(GamePhase.TrickComplete)
    s = continueAfterTrick(s)
    expect(s.phase).toBe(GamePhase.Playing)
  })

  it('President: first round AI play loop does not throw', () => {
    let s = createPresidentGame(['A', 'B', 'C', 'D'], -1)
    s = {
      ...s,
      players: s.players.map(p => ({ ...p, isHuman: false })),
    }
    s = startNewRound(s)
    // First round → Playing with 3♣ lead
    expect(s.phase).toBe(PresidentPhase.Playing)

    let guard = 0
    while (s.phase === PresidentPhase.Playing && guard++ < 80) {
      const seat = s.currentPlayer
      const player = s.players[seat]!
      if (player.finishOrder !== null) break
      const play = choosePresidentPlayHard(player, s.currentPile, s)
      if (play === null) {
        const next = processPass(s, seat)
        expect(next).not.toBe(s)
        s = next
      } else {
        const next = processPlay(s, seat, play)
        expect(next).not.toBe(s)
        s = next
      }
      if (s.phase === PresidentPhase.RoundComplete) break
    }
    // Made progress without hanging in a same-ref loop
    expect(guard).toBeGreaterThan(1)
    // Either finished the round or survived many turns without throwing
    expect(
      s.phase === PresidentPhase.RoundComplete || guard >= 10
    ).toBe(true)
  })

  it('President: exchange confirm path with forced ranks does not throw', () => {
    let s = createPresidentGame(['A', 'B', 'C', 'D'], 0)
    // Fake end of round ranks
    s = {
      ...s,
      players: s.players.map((p, i) => ({
        ...p,
        finishOrder: i === 0 ? 1 : i === 3 ? 4 : i + 1,
        isHuman: i === 0,
      })),
    }
    s = assignRanks(s)
    s = startNewRound(s)
    expect(s.phase).toBe(PresidentPhase.CardExchange)
    expect(s.exchangeParticipants.length).toBeGreaterThan(0)

    for (const part of [...s.exchangeParticipants]) {
      if (part.confirmed) continue
      const player = s.players[part.seatId]!
      const ids = part.canSelect
        ? chooseCardsToGiveBack(player, part.cardsNeeded).map(c => c.id)
        : part.cardIds
      s = confirmExchange(s, part.seatId, ids)
    }
    expect(s.phase).toBe(PresidentPhase.Playing)
  })
})
