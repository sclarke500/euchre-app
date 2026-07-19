import { describe, it, expect } from 'vitest'
import { FullRank, Suit } from '../../core/types.js'
import { PresidentPhase, PlayerRank } from '../types.js'
import {
  createPresidentGame,
  dealPresidentCards,
  assignRanks,
  initCardExchange,
  confirmExchange,
} from '../game.js'
import type { StandardCard } from '../../core/types.js'

function card(suit: Suit, rank: FullRank): StandardCard {
  return { suit, rank, id: `${suit}-${rank}` }
}

describe('president simultaneous card exchange', () => {
  function rankedDealt4() {
    let s = createPresidentGame(['A', 'B', 'C', 'D'], 0)
    s = dealPresidentCards(s)
    // Assign ranks by finish order: 0 Pres, 1 Citizen, 2 Citizen, 3 Scum
    s = {
      ...s,
      players: s.players.map((p, i) => ({
        ...p,
        finishOrder: i === 0 ? 1 : i === 3 ? 4 : i + 1,
      })),
    }
    s = assignRanks(s)
    // Controlled hands for exchange validation
    s = {
      ...s,
      players: s.players.map(p => {
        if (p.rank === PlayerRank.President) {
          return {
            ...p,
            hand: [
              card(Suit.Clubs, FullRank.Three),
              card(Suit.Clubs, FullRank.Four),
              card(Suit.Clubs, FullRank.Five),
              card(Suit.Clubs, FullRank.Six),
              card(Suit.Clubs, FullRank.Seven),
            ],
          }
        }
        if (p.rank === PlayerRank.Scum) {
          return {
            ...p,
            hand: [
              card(Suit.Hearts, FullRank.Ace),
              card(Suit.Hearts, FullRank.Two),
              card(Suit.Hearts, FullRank.King),
              card(Suit.Hearts, FullRank.Queen),
              card(Suit.Hearts, FullRank.Jack),
            ],
          }
        }
        return p
      }),
    }
    return initCardExchange(s)
  }

  it('inits Scum+President participants with Scum best cards preselected', () => {
    const s = rankedDealt4()
    expect(s.phase).toBe(PresidentPhase.CardExchange)
    expect(s.exchangeParticipants).toHaveLength(2)
    const scum = s.exchangeParticipants.find(p => !p.canSelect)!
    const pres = s.exchangeParticipants.find(p => p.canSelect)!
    expect(scum.cardIds).toHaveLength(2)
    expect(pres.cardIds).toHaveLength(0)
    expect(pres.cardsNeeded).toBe(2)
  })

  it('rejects bad president selection with same ref', () => {
    const s = rankedDealt4()
    const pres = s.exchangeParticipants.find(p => p.canSelect)!
    const rejected = confirmExchange(s, pres.seatId, ['nope'])
    expect(rejected).toBe(s)
  })

  it('executes swap when all seats confirm', () => {
    let s = rankedDealt4()
    const scum = s.exchangeParticipants.find(p => !p.canSelect)!
    const pres = s.exchangeParticipants.find(p => p.canSelect)!
    const scumHandBefore = s.players[scum.seatId]!.hand.map(c => c.id)
    const presGive = s.players[pres.seatId]!.hand.slice(0, 2).map(c => c.id)

    s = confirmExchange(s, scum.seatId, scum.cardIds)
    expect(s.phase).toBe(PresidentPhase.CardExchange)
    expect(s.exchangeParticipants.find(p => p.seatId === scum.seatId)?.confirmed).toBe(true)

    s = confirmExchange(s, pres.seatId, presGive)
    expect(s.phase).toBe(PresidentPhase.Playing)
    expect(s.exchangeParticipants).toHaveLength(0)
    expect(s.pendingExchanges).toHaveLength(2)

    // Scum no longer has their best cards; president received them
    const scumHand = s.players[scum.seatId]!.hand.map(c => c.id)
    for (const id of scum.cardIds) {
      expect(scumHand).not.toContain(id)
      expect(s.players[pres.seatId]!.hand.map(c => c.id)).toContain(id)
    }
    for (const id of presGive) {
      expect(s.players[pres.seatId]!.hand.map(c => c.id)).not.toContain(id)
      expect(scumHand).toContain(id)
    }
    // Scum leads
    expect(s.currentPlayer).toBe(scum.seatId)
    void scumHandBefore
  })
})
