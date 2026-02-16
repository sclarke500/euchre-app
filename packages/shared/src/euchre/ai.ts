import type { Card, Player, Trick, Suit, Bid } from './types.js'
import { BidAction, Rank } from './types.js'
import {
  shouldOrderUp,
  chooseSuitRound2,
  shouldGoAlone,
  countTrumpCards,
} from './trump.js'
import { getLegalPlays, getEffectiveSuit } from './trick.js'
import { compareCards, getCardValue } from './deck.js'

/**
 * AI makes a bidding decision for round 1 (turn card)
 */
export function makeAIBidRound1(
  player: Player,
  turnCard: Card,
  dealerPosition: number
): Bid {
  const isDealer = player.id === dealerPosition
  const shouldBid = shouldOrderUp(player.hand, turnCard, player.id, dealerPosition, isDealer)

  if (shouldBid) {
    const goingAlone = shouldGoAlone(player.hand, turnCard.suit)

    if (isDealer) {
      return {
        playerId: player.id,
        action: BidAction.PickUp,
        goingAlone,
      }
    } else {
      return {
        playerId: player.id,
        action: BidAction.OrderUp,
        goingAlone,
      }
    }
  }

  return {
    playerId: player.id,
    action: BidAction.Pass,
  }
}

/**
 * AI makes a bidding decision for round 2 (call any suit)
 * @param stickTheDealer - If true and player is dealer, must call a suit
 */
export function makeAIBidRound2(
  player: Player,
  turnCardSuit: Suit,
  dealerPosition: number,
  stickTheDealer: boolean = false
): Bid {
  const isDealer = player.id === dealerPosition
  const mustCall = stickTheDealer && isDealer
  const chosenSuit = chooseSuitRound2(player.hand, turnCardSuit, isDealer, mustCall)

  if (chosenSuit) {
    const goingAlone = shouldGoAlone(player.hand, chosenSuit)

    return {
      playerId: player.id,
      action: BidAction.CallTrump,
      suit: chosenSuit,
      goingAlone,
    }
  }

  // No good suit - pass (hand will be thrown in if all pass)
  return {
    playerId: player.id,
    action: BidAction.Pass,
  }
}

/**
 * Choose the best suit from remaining options
 */
function chooseBestSuit(hand: Card[], excludeSuit: Suit): Suit {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'].filter(
    (s) => s !== excludeSuit
  ) as Suit[]

  let bestSuit = suits[0]!
  let bestCount = 0

  for (const suit of suits) {
    const count = countTrumpCards(hand, suit)
    if (count > bestCount) {
      bestCount = count
      bestSuit = suit
    }
  }

  return bestSuit
}

/**
 * AI chooses which card to play
 * Uses basic strategy:
 * 1. If leading, play highest trump or highest card
 * 2. If following suit, try to win with lowest winning card
 * 3. If can't follow suit, trump if partner isn't winning
 * 4. Otherwise, discard lowest card
 */
export function chooseCardToPlay(
  player: Player,
  trick: Trick,
  trump: Suit,
  partnerWinning: boolean
): Card {
  const legalPlays = getLegalPlays(player.hand, trick, trump)

  if (legalPlays.length === 0) {
    throw new Error('No legal plays available')
  }

  if (legalPlays.length === 1) {
    return legalPlays[0]!
  }

  // Leading the trick
  if (trick.cards.length === 0) {
    return chooseLeadCard(legalPlays, trump)
  }

  // Following in the trick
  return chooseFollowCard(legalPlays, trick, trump, partnerWinning)
}

/**
 * Choose which card to lead with
 * Strategy: Lead with trump if you have strong trump, otherwise lead high cards
 */
function chooseLeadCard(legalPlays: Card[], trump: Suit): Card {
  const trumpCards = legalPlays.filter((c) => getEffectiveSuit(c, trump) === trump)
  const nonTrumpCards = legalPlays.filter((c) => getEffectiveSuit(c, trump) !== trump)

  // If you have 3+ trump, lead with lowest trump to draw them out
  if (trumpCards.length >= 3) {
    return getLowestCard(trumpCards, trump, null)!
  }

  // If you have strong trump (Jack), lead it
  const rightBower = trumpCards.find((c) => c.rank === Rank.Jack && c.suit === trump)
  if (rightBower) {
    return rightBower
  }

  // Otherwise, lead with highest non-trump
  if (nonTrumpCards.length > 0) {
    return getHighestCard(nonTrumpCards, trump, null)!
  }

  // Only trump left, lead highest
  return getHighestCard(trumpCards, trump, null)!
}

/**
 * Choose which card to follow with
 */
function chooseFollowCard(
  legalPlays: Card[],
  trick: Trick,
  trump: Suit,
  partnerWinning: boolean
): Card {
  const currentWinningCard = getCurrentWinningCard(trick, trump)

  // If partner is winning, play lowest card
  if (partnerWinning) {
    return getLowestCard(legalPlays, trump, trick.leadingSuit)!
  }

  // Try to win the trick with the lowest winning card
  const winningCards = legalPlays.filter((card) =>
    compareCards(card, currentWinningCard, trump, trick.leadingSuit) > 0
  )

  if (winningCards.length > 0) {
    return getLowestCard(winningCards, trump, trick.leadingSuit)!
  }

  // Can't win, play lowest card
  return getLowestCard(legalPlays, trump, trick.leadingSuit)!
}

/**
 * Get the currently winning card in a trick
 */
function getCurrentWinningCard(trick: Trick, trump: Suit): Card {
  if (trick.cards.length === 0) {
    throw new Error('No cards in trick')
  }

  let winningCard = trick.cards[0]!.card

  for (let i = 1; i < trick.cards.length; i++) {
    const card = trick.cards[i]!.card
    if (compareCards(card, winningCard, trump, trick.leadingSuit) > 0) {
      winningCard = card
    }
  }

  return winningCard
}

/**
 * Get the highest value card from a set
 */
function getHighestCard(cards: Card[], trump: Suit, leadingSuit: Suit | null): Card | undefined {
  if (cards.length === 0) return undefined
  let highest = cards[0]!
  let highestValue = getCardValue(highest, trump, leadingSuit)

  for (const card of cards) {
    const value = getCardValue(card, trump, leadingSuit)
    if (value > highestValue) {
      highestValue = value
      highest = card
    }
  }

  return highest
}

/**
 * Get the lowest value card from a set
 */
function getLowestCard(cards: Card[], trump: Suit, leadingSuit: Suit | null): Card | undefined {
  if (cards.length === 0) return undefined
  let lowest = cards[0]!
  let lowestValue = getCardValue(lowest, trump, leadingSuit)

  for (const card of cards) {
    const value = getCardValue(card, trump, leadingSuit)
    if (value < lowestValue) {
      lowestValue = value
      lowest = card
    }
  }

  return lowest
}

/**
 * Check if partner is currently winning the trick
 */
export function isPartnerWinning(
  trick: Trick,
  playerId: number,
  trump: Suit
): boolean {
  if (trick.cards.length === 0) {
    return false
  }

  const winningCard = getCurrentWinningCard(trick, trump)
  const winningPlayerId = trick.cards.find((pc) => pc.card === winningCard)?.playerId

  if (winningPlayerId === undefined) {
    return false
  }

  // Partner is across the table (differ by 2)
  const partnerId = (playerId + 2) % 4
  return winningPlayerId === partnerId
}

/**
 * Dealer discards a card after picking up the turn card
 */
export function chooseDealerDiscard(hand: Card[], trump: Suit): Card {
  // Discard lowest non-trump card
  const nonTrumpCards = hand.filter((c) => getEffectiveSuit(c, trump) !== trump)

  if (nonTrumpCards.length > 0) {
    const card = getLowestCard(nonTrumpCards, trump, null)
    if (card) return card
  }

  // All trump, discard lowest
  const card = getLowestCard(hand, trump, null)
  if (!card) throw new Error('No cards in hand to discard')
  return card
}
