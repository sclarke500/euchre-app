import { describe, it, expect } from 'vitest'
import { Suit, Rank } from '../types.js'
import type { Card, Trick } from '../types.js'
import {
  createTrick,
  isLegalPlay,
  getLegalPlays,
  playCardToTrick,
  determineTrickWinner,
  completeTrick,
  countTricksWonByTeam,
  isTrickComplete,
  isPlayerSittingOut,
} from '../trick.js'

// Helper to make cards concisely
function card(suit: Suit, rank: Rank): Card {
  return { suit, rank, id: `${suit}-${rank}` }
}

describe('createTrick', () => {
  it('creates an empty trick', () => {
    const trick = createTrick()
    expect(trick.cards).toEqual([])
    expect(trick.leadingSuit).toBeNull()
    expect(trick.winnerId).toBeNull()
  })
})

describe('isLegalPlay', () => {
  const trump = Suit.Spades

  it('allows any card as the first play', () => {
    const trick = createTrick()
    const hand = [card(Suit.Hearts, Rank.Nine)]
    expect(isLegalPlay(hand[0]!, hand, trick, trump)).toBe(true)
  })

  it('requires following suit when player has it', () => {
    const trick: Trick = {
      cards: [{ card: card(Suit.Hearts, Rank.Ace), playerId: 0 }],
      leadingSuit: Suit.Hearts,
      winnerId: null,
    }
    const hand = [
      card(Suit.Hearts, Rank.Nine),
      card(Suit.Diamonds, Rank.Ace),
    ]
    // Must play hearts
    expect(isLegalPlay(hand[0]!, hand, trick, trump)).toBe(true)
    expect(isLegalPlay(hand[1]!, hand, trick, trump)).toBe(false)
  })

  it('allows any card when player cannot follow suit', () => {
    const trick: Trick = {
      cards: [{ card: card(Suit.Hearts, Rank.Ace), playerId: 0 }],
      leadingSuit: Suit.Hearts,
      winnerId: null,
    }
    const hand = [
      card(Suit.Diamonds, Rank.Nine),
      card(Suit.Clubs, Rank.Ace),
    ]
    expect(isLegalPlay(hand[0]!, hand, trick, trump)).toBe(true)
    expect(isLegalPlay(hand[1]!, hand, trick, trump)).toBe(true)
  })

  it('treats left bower as trump suit for follow-suit', () => {
    // Trump is spades. Jack of clubs is the left bower (same color).
    const trick: Trick = {
      cards: [{ card: card(Suit.Spades, Rank.Ace), playerId: 0 }],
      leadingSuit: Suit.Spades,
      winnerId: null,
    }
    const leftBower = card(Suit.Clubs, Rank.Jack)
    const hand = [leftBower, card(Suit.Diamonds, Rank.Nine)]

    // Left bower counts as spades, so it follows suit
    expect(isLegalPlay(leftBower, hand, trick, trump)).toBe(true)
  })

  it('left bower does NOT follow clubs when trump is spades', () => {
    // Trump is spades. Jack of clubs is left bower (counts as spades, not clubs).
    const trick: Trick = {
      cards: [{ card: card(Suit.Clubs, Rank.Ace), playerId: 0 }],
      leadingSuit: Suit.Clubs,
      winnerId: null,
    }
    const leftBower = card(Suit.Clubs, Rank.Jack)
    // Only other card is a diamond — can't follow clubs
    const hand = [leftBower, card(Suit.Diamonds, Rank.Nine)]

    // Left bower is effectively spades, not clubs. Player has no clubs.
    // So any card is legal.
    expect(isLegalPlay(leftBower, hand, trick, trump)).toBe(true)
    expect(isLegalPlay(hand[1]!, hand, trick, trump)).toBe(true)
  })
})

describe('getLegalPlays', () => {
  it('returns all cards when leading', () => {
    const hand = [
      card(Suit.Hearts, Rank.Nine),
      card(Suit.Diamonds, Rank.Ace),
      card(Suit.Spades, Rank.King),
    ]
    const legal = getLegalPlays(hand, createTrick(), Suit.Spades)
    expect(legal).toHaveLength(3)
  })

  it('filters to matching suit when must follow', () => {
    const trick: Trick = {
      cards: [{ card: card(Suit.Hearts, Rank.Ace), playerId: 0 }],
      leadingSuit: Suit.Hearts,
      winnerId: null,
    }
    const hand = [
      card(Suit.Hearts, Rank.Nine),
      card(Suit.Hearts, Rank.Ten),
      card(Suit.Diamonds, Rank.Ace),
    ]
    const legal = getLegalPlays(hand, trick, Suit.Spades)
    expect(legal).toHaveLength(2)
    expect(legal.every(c => c.suit === Suit.Hearts)).toBe(true)
  })
})

describe('playCardToTrick', () => {
  it('sets leading suit on first card', () => {
    const trick = createTrick()
    const result = playCardToTrick(trick, card(Suit.Hearts, Rank.Ace), 0, Suit.Spades)
    expect(result.cards).toHaveLength(1)
    expect(result.leadingSuit).toBe(Suit.Hearts)
  })

  it('does not change leading suit on subsequent cards', () => {
    const trick: Trick = {
      cards: [{ card: card(Suit.Hearts, Rank.Ace), playerId: 0 }],
      leadingSuit: Suit.Hearts,
      winnerId: null,
    }
    const result = playCardToTrick(trick, card(Suit.Spades, Rank.King), 1, Suit.Spades)
    expect(result.cards).toHaveLength(2)
    expect(result.leadingSuit).toBe(Suit.Hearts)
  })

  it('sets leading suit to effective suit for left bower', () => {
    const trick = createTrick()
    // Trump is spades, playing jack of clubs (left bower) — effective suit is spades
    const result = playCardToTrick(trick, card(Suit.Clubs, Rank.Jack), 0, Suit.Spades)
    expect(result.leadingSuit).toBe(Suit.Spades)
  })
})

describe('determineTrickWinner', () => {
  it('highest card of leading suit wins when no trump played', () => {
    const trick: Trick = {
      cards: [
        { card: card(Suit.Hearts, Rank.Nine), playerId: 0 },
        { card: card(Suit.Hearts, Rank.Ace), playerId: 1 },
        { card: card(Suit.Hearts, Rank.King), playerId: 2 },
        { card: card(Suit.Hearts, Rank.Ten), playerId: 3 },
      ],
      leadingSuit: Suit.Hearts,
      winnerId: null,
    }
    expect(determineTrickWinner(trick, Suit.Spades)).toBe(1) // Ace wins
  })

  it('trump beats non-trump', () => {
    const trick: Trick = {
      cards: [
        { card: card(Suit.Hearts, Rank.Ace), playerId: 0 },
        { card: card(Suit.Spades, Rank.Nine), playerId: 1 }, // trump
        { card: card(Suit.Hearts, Rank.King), playerId: 2 },
        { card: card(Suit.Diamonds, Rank.Ace), playerId: 3 },
      ],
      leadingSuit: Suit.Hearts,
      winnerId: null,
    }
    expect(determineTrickWinner(trick, Suit.Spades)).toBe(1) // 9 of trump beats all
  })

  it('right bower beats everything', () => {
    const trick: Trick = {
      cards: [
        { card: card(Suit.Spades, Rank.Ace), playerId: 0 },
        { card: card(Suit.Spades, Rank.Jack), playerId: 1 }, // right bower
        { card: card(Suit.Clubs, Rank.Jack), playerId: 2 }, // left bower
        { card: card(Suit.Spades, Rank.King), playerId: 3 },
      ],
      leadingSuit: Suit.Spades,
      winnerId: null,
    }
    expect(determineTrickWinner(trick, Suit.Spades)).toBe(1) // right bower wins
  })

  it('left bower beats all except right bower', () => {
    const trick: Trick = {
      cards: [
        { card: card(Suit.Spades, Rank.Ace), playerId: 0 },
        { card: card(Suit.Spades, Rank.King), playerId: 1 },
        { card: card(Suit.Clubs, Rank.Jack), playerId: 2 }, // left bower
        { card: card(Suit.Spades, Rank.Queen), playerId: 3 },
      ],
      leadingSuit: Suit.Spades,
      winnerId: null,
    }
    expect(determineTrickWinner(trick, Suit.Spades)).toBe(2) // left bower wins
  })

  it('off-suit cards lose to leading suit', () => {
    const trick: Trick = {
      cards: [
        { card: card(Suit.Hearts, Rank.Nine), playerId: 0 },
        { card: card(Suit.Diamonds, Rank.Ace), playerId: 1 }, // off suit
      ],
      leadingSuit: Suit.Hearts,
      winnerId: null,
    }
    expect(determineTrickWinner(trick, Suit.Spades)).toBe(0)
  })
})

describe('countTricksWonByTeam', () => {
  it('counts tricks per team correctly', () => {
    const tricks: Trick[] = [
      { cards: [], leadingSuit: null, winnerId: 0 }, // team 0
      { cards: [], leadingSuit: null, winnerId: 1 }, // team 1
      { cards: [], leadingSuit: null, winnerId: 2 }, // team 0
      { cards: [], leadingSuit: null, winnerId: 3 }, // team 1
      { cards: [], leadingSuit: null, winnerId: 0 }, // team 0
    ]
    expect(countTricksWonByTeam(tricks)).toEqual([3, 2])
  })

  it('skips tricks without a winner', () => {
    const tricks: Trick[] = [
      { cards: [], leadingSuit: null, winnerId: null },
      { cards: [], leadingSuit: null, winnerId: 0 },
    ]
    expect(countTricksWonByTeam(tricks)).toEqual([1, 0])
  })
})

describe('isTrickComplete', () => {
  it('requires 4 cards normally', () => {
    const trick: Trick = {
      cards: [
        { card: card(Suit.Hearts, Rank.Nine), playerId: 0 },
        { card: card(Suit.Hearts, Rank.Ten), playerId: 1 },
        { card: card(Suit.Hearts, Rank.Queen), playerId: 2 },
      ],
      leadingSuit: Suit.Hearts,
      winnerId: null,
    }
    expect(isTrickComplete(trick, false)).toBe(false)
    trick.cards.push({ card: card(Suit.Hearts, Rank.King), playerId: 3 })
    expect(isTrickComplete(trick, false)).toBe(true)
  })

  it('requires only 3 cards when going alone', () => {
    const trick: Trick = {
      cards: [
        { card: card(Suit.Hearts, Rank.Nine), playerId: 0 },
        { card: card(Suit.Hearts, Rank.Ten), playerId: 1 },
        { card: card(Suit.Hearts, Rank.Queen), playerId: 2 },
      ],
      leadingSuit: Suit.Hearts,
      winnerId: null,
    }
    expect(isTrickComplete(trick, true)).toBe(true)
  })
})

describe('isPlayerSittingOut', () => {
  it('returns false when no one is going alone', () => {
    expect(isPlayerSittingOut(0, null)).toBe(false)
    expect(isPlayerSittingOut(2, null)).toBe(false)
  })

  it('partner of alone player sits out', () => {
    // Player 0 goes alone → partner is player 2
    expect(isPlayerSittingOut(2, 0)).toBe(true)
    expect(isPlayerSittingOut(0, 0)).toBe(false)
    expect(isPlayerSittingOut(1, 0)).toBe(false)
    expect(isPlayerSittingOut(3, 0)).toBe(false)
  })

  it('works for all player positions', () => {
    expect(isPlayerSittingOut(3, 1)).toBe(true) // 1 alone → 3 sits
    expect(isPlayerSittingOut(0, 2)).toBe(true) // 2 alone → 0 sits
    expect(isPlayerSittingOut(1, 3)).toBe(true) // 3 alone → 1 sits
  })
})
