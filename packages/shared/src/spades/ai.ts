// Spades AI logic

import { Suit, FullRank } from '../core/types.js'
import type { StandardCard } from '../core/types.js'
import {
  SpadesBidType,
  type SpadesGameState,
  type SpadesPlayer,
  type SpadesBid,
  type SpadesTrick,
} from './types.js'
import {
  estimateTricks,
  isNilCandidate,
  createBid,
  createNilBid,
  countSpades,
  countHighSpades,
} from './bidding.js'
import { getLegalPlays, getSpadesCardValue } from './tricks.js'

/**
 * AI chooses a bid
 */
export function chooseSpadesBid(
  player: SpadesPlayer,
  gameState: SpadesGameState
): SpadesBid {
  const hand = player.hand

  // Consider nil if hand is weak
  if (isNilCandidate(hand)) {
    // More likely to bid nil if team is behind
    const teamScore = gameState.scores[player.teamId]?.score ?? 0
    const opponentScore = gameState.scores[1 - player.teamId]?.score ?? 0

    if (teamScore < opponentScore - 50 || Math.random() < 0.3) {
      return createNilBid()
    }
  }

  // Estimate tricks
  let estimate = estimateTricks(hand)

  // Adjust based on partner's bid if available
  const partner = gameState.players.find(
    p => p.teamId === player.teamId && p.id !== player.id
  )

  if (partner?.bid) {
    // If partner bid nil, we might bid more aggressively
    if (partner.bid.type !== SpadesBidType.Normal) {
      estimate = Math.min(estimate + 1, 13)
    }
    // If partner bid high, be more conservative
    else if (partner.bid.count >= 5) {
      estimate = Math.max(estimate - 1, 0)
    }
  }

  // Add some randomness (-1 to +1)
  const variance = Math.floor(Math.random() * 3) - 1
  estimate = Math.max(0, Math.min(13, estimate + variance))

  return createBid(estimate)
}

/**
 * Get the lowest card in a suit
 */
function getLowestInSuit(hand: StandardCard[], suit: Suit): StandardCard | null {
  const suitCards = hand.filter(c => c.suit === suit)
  if (suitCards.length === 0) return null

  return suitCards.reduce((lowest, card) => {
    const currentValue = getSpadesCardValue(card, null)
    const lowestValue = getSpadesCardValue(lowest, null)
    return currentValue < lowestValue ? card : lowest
  })
}

/**
 * Get the highest card in a suit
 */
function getHighestInSuit(hand: StandardCard[], suit: Suit): StandardCard | null {
  const suitCards = hand.filter(c => c.suit === suit)
  if (suitCards.length === 0) return null

  return suitCards.reduce((highest, card) => {
    const currentValue = getSpadesCardValue(card, null)
    const highestValue = getSpadesCardValue(highest, null)
    return currentValue > highestValue ? card : highest
  })
}

/**
 * Check if partner is currently winning the trick
 */
export function isPartnerWinning(
  trick: SpadesTrick,
  playerId: number
): boolean {
  if (trick.cards.length === 0) return false

  // Find current winner
  let winningCard = trick.cards[0]!
  for (const played of trick.cards) {
    const currentValue = getSpadesCardValue(played.card, trick.leadingSuit)
    const winningValue = getSpadesCardValue(winningCard.card, trick.leadingSuit)
    if (currentValue > winningValue) {
      winningCard = played
    }
  }

  // Partner is across (differ by 2)
  const partnerId = (playerId + 2) % 4
  return winningCard.playerId === partnerId
}

/**
 * Get the minimum card needed to beat the current trick
 */
function getMinimumWinner(
  hand: StandardCard[],
  trick: SpadesTrick
): StandardCard | null {
  if (trick.cards.length === 0) return null

  // Find current winning value
  let winningValue = 0
  for (const played of trick.cards) {
    const value = getSpadesCardValue(played.card, trick.leadingSuit)
    if (value > winningValue) {
      winningValue = value
    }
  }

  // Find minimum card that beats it
  const legalPlays = getLegalPlays(hand, trick, true)
  const winners = legalPlays.filter(card => {
    const value = getSpadesCardValue(card, trick.leadingSuit)
    return value > winningValue
  })

  if (winners.length === 0) return null

  return winners.reduce((min, card) => {
    const currentValue = getSpadesCardValue(card, trick.leadingSuit)
    const minValue = getSpadesCardValue(min, trick.leadingSuit)
    return currentValue < minValue ? card : min
  })
}

/**
 * AI chooses a card to play
 */
export function chooseSpadesCard(
  player: SpadesPlayer,
  gameState: SpadesGameState
): StandardCard {
  const hand = player.hand
  const trick = gameState.currentTrick
  const legalPlays = getLegalPlays(hand, trick, gameState.spadesBroken)

  if (legalPlays.length === 0) {
    throw new Error('No legal plays available')
  }

  if (legalPlays.length === 1) {
    return legalPlays[0]!
  }

  // Nil bidder - try to lose tricks
  if (player.bid?.type === SpadesBidType.Nil || player.bid?.type === SpadesBidType.BlindNil) {
    return playForNil(legalPlays, trick)
  }

  const partnerWinning = isPartnerWinning(trick, player.id)
  const teamBid = gameState.players
    .filter(p => p.teamId === player.teamId)
    .reduce((sum, p) => {
      if (!p.bid || p.bid.type !== SpadesBidType.Normal) return sum
      return sum + p.bid.count
    }, 0)
  const teamTricks = gameState.players
    .filter(p => p.teamId === player.teamId)
    .reduce((sum, p) => sum + p.tricksWon, 0)

  const needMoreTricks = teamTricks < teamBid
  const tricksRemaining = 13 - gameState.completedTricks.length

  // Leading the trick
  if (trick.cards.length === 0) {
    return leadCard(legalPlays, gameState, needMoreTricks)
  }

  // Following in trick
  if (partnerWinning && !needMoreTricks) {
    // Partner winning and we don't need more tricks - play low
    return playLowest(legalPlays, trick)
  }

  if (needMoreTricks || trick.cards.length === 3) {
    // We need tricks or we're last to play - try to win
    const winner = getMinimumWinner(hand, trick)
    if (winner && legalPlays.includes(winner)) {
      return winner
    }
  }

  // Default - play lowest legal card
  return playLowest(legalPlays, trick)
}

/**
 * Choose card when leading
 */
function leadCard(
  legalPlays: StandardCard[],
  gameState: SpadesGameState,
  needTricks: boolean
): StandardCard {
  // If we need tricks and have high spades, lead one
  if (needTricks) {
    const highSpades = legalPlays.filter(
      c => c.suit === Suit.Spades &&
        [FullRank.Ace, FullRank.King, FullRank.Queen].includes(c.rank)
    )
    if (highSpades.length > 0) {
      return highSpades[0]!
    }

    // Lead high card from longest non-spade suit
    const nonSpades = legalPlays.filter(c => c.suit !== Suit.Spades)
    if (nonSpades.length > 0) {
      // Find longest suit
      const suitCounts: Partial<Record<Suit, number>> = {}
      for (const card of nonSpades) {
        suitCounts[card.suit] = (suitCounts[card.suit] ?? 0) + 1
      }

      let longestSuit: Suit = nonSpades[0]!.suit
      let maxCount = 0
      for (const [suit, count] of Object.entries(suitCounts)) {
        if (count > maxCount) {
          maxCount = count
          longestSuit = suit as Suit
        }
      }

      const suitCards = nonSpades.filter(c => c.suit === longestSuit)
      // Lead highest in that suit
      return suitCards.reduce((high, card) => {
        const currentValue = getSpadesCardValue(card, null)
        const highValue = getSpadesCardValue(high, null)
        return currentValue > highValue ? card : high
      })
    }
  }

  // Don't need tricks - lead low from short suit
  const nonSpades = legalPlays.filter(c => c.suit !== Suit.Spades)
  if (nonSpades.length > 0) {
    return nonSpades.reduce((low, card) => {
      const currentValue = getSpadesCardValue(card, null)
      const lowValue = getSpadesCardValue(low, null)
      return currentValue < lowValue ? card : low
    })
  }

  // Only spades - lead lowest
  return legalPlays.reduce((low, card) => {
    const currentValue = getSpadesCardValue(card, null)
    const lowValue = getSpadesCardValue(low, null)
    return currentValue < lowValue ? card : low
  })
}

/**
 * Play lowest legal card
 */
function playLowest(legalPlays: StandardCard[], trick: SpadesTrick): StandardCard {
  return legalPlays.reduce((low, card) => {
    const currentValue = getSpadesCardValue(card, trick.leadingSuit)
    const lowValue = getSpadesCardValue(low, trick.leadingSuit)
    return currentValue < lowValue ? card : low
  })
}

/**
 * Play strategy for nil bidder - try to lose
 */
function playForNil(legalPlays: StandardCard[], trick: SpadesTrick): StandardCard {
  if (trick.cards.length === 0) {
    // Leading - play lowest card
    return legalPlays.reduce((low, card) => {
      const currentValue = getSpadesCardValue(card, null)
      const lowValue = getSpadesCardValue(low, null)
      return currentValue < lowValue ? card : low
    })
  }

  // Following - find highest card that still loses
  const leadingSuit = trick.leadingSuit

  // Find current winning value
  let winningValue = 0
  for (const played of trick.cards) {
    const value = getSpadesCardValue(played.card, leadingSuit)
    if (value > winningValue) {
      winningValue = value
    }
  }

  // Find cards that lose to current winner
  const losers = legalPlays.filter(card => {
    const value = getSpadesCardValue(card, leadingSuit)
    return value < winningValue
  })

  if (losers.length > 0) {
    // Play highest losing card (save low cards)
    return losers.reduce((high, card) => {
      const currentValue = getSpadesCardValue(card, leadingSuit)
      const highValue = getSpadesCardValue(high, leadingSuit)
      return currentValue > highValue ? card : high
    })
  }

  // No way to lose - play lowest card
  return playLowest(legalPlays, trick)
}
