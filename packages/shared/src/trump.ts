import type { Card, Suit, Trump, Bid } from './game.js'
import { BidAction, Suit as SuitEnum } from './game.js'
import { getSameColorSuit } from './deck.js'

/**
 * Evaluate if a player should order up the turn card (round 1)
 * Returns true if AI should order up
 *
 * Key consideration: Who benefits from the turn card?
 * - If dealer is on your team, ordering up helps your team
 * - If dealer is opponent, ordering up gives them the card
 */
export function shouldOrderUp(
  hand: Card[],
  turnCard: Card,
  playerPosition: number,
  dealerPosition: number,
  isDealer: boolean
): boolean {
  const trumpSuit = turnCard.suit
  const trumpCount = countTrumpCards(hand, trumpSuit)
  const hasBower = hasRightOrLeftBower(hand, trumpSuit)

  // Check if dealer is on the same team (partners are positions 0&2 or 1&3)
  const dealerIsTeammate = playerPosition % 2 === dealerPosition % 2

  // Dealer picking up for themselves - most favorable
  if (isDealer) {
    // Pick up with 2+ trump or any bower
    return trumpCount >= 2 || hasBower
  }

  // Ordering up your partner (dealer is teammate) - favorable
  // Your team gets the turn card, so be somewhat willing
  if (dealerIsTeammate) {
    // Need 2+ trump with a bower, or 3+ trump
    if (hasBower && trumpCount >= 2) {
      return true
    }
    return trumpCount >= 3
  }

  // Ordering up an opponent - least favorable
  // You're giving the opponent the turn card, need a strong hand
  // Need 3+ trump with a bower, or 4+ trump
  if (hasBower && trumpCount >= 3) {
    return true
  }
  return trumpCount >= 4
}

/**
 * Evaluate if dealer should pick up the turn card
 */
export function shouldPickUp(hand: Card[], turnCard: Card): boolean {
  // Dealer always picks up if ordered
  // This function is for dealer's decision when it comes around
  return shouldOrderUp(hand, turnCard, 0, 0, true)
}

/**
 * Choose best suit to call in round 2 (after turn card is rejected)
 * Returns the suit to call, or null to pass
 */
export function chooseSuitRound2(
  hand: Card[],
  turnCardSuit: Suit,
  isDealer: boolean
): Suit | null {
  // Count trump in each suit (excluding the turned down suit)
  const suitScores = new Map<Suit, number>()

  // Can't call the suit that was turned down
  const availableSuits = Object.values(SuitEnum).filter((s) => s !== turnCardSuit) as Suit[]

  for (const suit of availableSuits) {
    const count = countTrumpCards(hand, suit)
    const hasBower = hasRightOrLeftBower(hand, suit)
    const score = count + (hasBower ? 2 : 0)

    suitScores.set(suit, score)
  }

  // Find suit with highest score
  let bestSuit: Suit | null = null
  let bestScore = isDealer ? 1 : 2 // Dealer must call with lower threshold (stick the dealer)

  for (const [suit, score] of suitScores) {
    if (score > bestScore) {
      bestScore = score
      bestSuit = suit
    }
  }

  return bestSuit
}

/**
 * Decide if player should go alone
 * Going alone is risky but gives 4 points if successful
 */
export function shouldGoAlone(hand: Card[], trumpSuit: Suit): boolean {
  const trumpCount = countTrumpCards(hand, trumpSuit)
  const hasRightBower = hand.some(
    (c) => c.rank === 'J' && c.suit === trumpSuit
  )
  const hasLeftBower = hand.some(
    (c) => c.rank === 'J' && c.suit === getSameColorSuit(trumpSuit)
  )
  const hasAce = hand.some((c) => c.rank === 'A' && c.suit === trumpSuit)

  // Go alone if you have:
  // - Right bower + 3+ other trump
  // - Both bowers + 2+ other trump
  // - Right bower + left bower + ace
  if (hasRightBower && hasLeftBower && trumpCount >= 4) {
    return true
  }

  if (hasRightBower && hasLeftBower && hasAce) {
    return true
  }

  if (hasRightBower && trumpCount >= 4) {
    return true
  }

  return false
}

/**
 * Count how many trump cards in hand (including left bower)
 */
export function countTrumpCards(hand: Card[], trumpSuit: Suit): number {
  let count = 0

  for (const card of hand) {
    // Regular trump
    if (card.suit === trumpSuit) {
      count++
    }
    // Left bower (jack of same color)
    else if (card.rank === 'J' && card.suit === getSameColorSuit(trumpSuit)) {
      count++
    }
  }

  return count
}

/**
 * Check if hand has right or left bower
 */
export function hasRightOrLeftBower(hand: Card[], trumpSuit: Suit): boolean {
  const hasRight = hand.some((c) => c.rank === 'J' && c.suit === trumpSuit)
  const hasLeft = hand.some(
    (c) => c.rank === 'J' && c.suit === getSameColorSuit(trumpSuit)
  )

  return hasRight || hasLeft
}

/**
 * Process a bid action and return updated trump state
 */
export function processBid(
  bid: Bid,
  turnCard: Card | null,
  currentTrump: Trump | null
): Trump | null {
  switch (bid.action) {
    case BidAction.OrderUp:
    case BidAction.PickUp:
      if (!turnCard) return null
      return {
        suit: turnCard.suit,
        calledBy: bid.playerId,
        goingAlone: bid.goingAlone || false,
      }

    case BidAction.CallTrump:
      if (!bid.suit) return null
      return {
        suit: bid.suit,
        calledBy: bid.playerId,
        goingAlone: bid.goingAlone || false,
      }

    case BidAction.Pass:
      return currentTrump

    case BidAction.GoAlone:
      // Update existing trump to go alone
      if (!currentTrump) return null
      return {
        ...currentTrump,
        goingAlone: true,
      }

    default:
      return currentTrump
  }
}
