import type { Card, Trick, PlayedCard, Suit } from './game.js'
import { compareCards, getEffectiveSuit } from './deck.js'

export { getEffectiveSuit }

/**
 * Create a new empty trick
 */
export function createTrick(): Trick {
  return {
    cards: [],
    leadingSuit: null,
    winnerId: null,
  }
}

/**
 * Validate if a card can be legally played
 * Must follow suit if possible
 */
export function isLegalPlay(
  card: Card,
  hand: Card[],
  trick: Trick,
  trump: Suit
): boolean {
  // First card of trick - always legal
  if (trick.cards.length === 0) {
    return true
  }

  const leadingSuit = trick.leadingSuit
  if (!leadingSuit) {
    return true
  }

  // Get effective suit of the card being played (important for left bower)
  const effectiveSuit = getEffectiveSuit(card, trump)

  // If playing a card that matches leading suit, it's legal
  if (effectiveSuit === leadingSuit) {
    return true
  }

  // Check if player has any cards of the leading suit
  const hasLeadingSuit = hand.some((c) => getEffectiveSuit(c, trump) === leadingSuit)

  // If player has leading suit, they must play it
  if (hasLeadingSuit) {
    return false
  }

  // Player doesn't have leading suit, can play anything
  return true
}

/**
 * Get all legal cards that can be played from hand
 */
export function getLegalPlays(hand: Card[], trick: Trick, trump: Suit): Card[] {
  return hand.filter((card) => isLegalPlay(card, hand, trick, trump))
}

/**
 * Add a card to the current trick
 */
export function playCardToTrick(
  trick: Trick,
  card: Card,
  playerId: number,
  trump: Suit
): Trick {
  const playedCard: PlayedCard = {
    card,
    playerId,
  }

  const cards = [...trick.cards, playedCard]

  // Set leading suit if this is the first card
  let leadingSuit = trick.leadingSuit
  if (cards.length === 1) {
    leadingSuit = getEffectiveSuit(card, trump)
  }

  return {
    ...trick,
    cards,
    leadingSuit,
  }
}

/**
 * Determine the winner of a completed trick
 * Returns the player ID who won
 */
export function determineTrickWinner(trick: Trick, trump: Suit): number {
  if (trick.cards.length === 0) {
    throw new Error('Cannot determine winner of empty trick')
  }

  let winningCard = trick.cards[0]!
  let winnerId = winningCard.playerId

  // Compare each card to find the strongest
  for (let i = 1; i < trick.cards.length; i++) {
    const currentCard = trick.cards[i]!
    const comparison = compareCards(
      currentCard.card,
      winningCard.card,
      trump,
      trick.leadingSuit
    )

    if (comparison > 0) {
      winningCard = currentCard
      winnerId = currentCard.playerId
    }
  }

  return winnerId
}

/**
 * Complete a trick by determining the winner
 */
export function completeTrick(trick: Trick, trump: Suit): Trick {
  const winnerId = determineTrickWinner(trick, trump)

  return {
    ...trick,
    winnerId,
  }
}

/**
 * Count tricks won by each team
 * Returns [team0Tricks, team1Tricks]
 */
export function countTricksWonByTeam(tricks: Trick[]): [number, number] {
  let team0Tricks = 0
  let team1Tricks = 0

  for (const trick of tricks) {
    if (trick.winnerId === null) continue

    // Team 0: players 0 and 2
    // Team 1: players 1 and 3
    const teamId = trick.winnerId % 2

    if (teamId === 0) {
      team0Tricks++
    } else {
      team1Tricks++
    }
  }

  return [team0Tricks, team1Tricks]
}

/**
 * Check if trick is complete (4 cards played, or fewer if going alone)
 */
export function isTrickComplete(trick: Trick, goingAlone: boolean): boolean {
  const requiredCards = goingAlone ? 3 : 4
  return trick.cards.length === requiredCards
}

/**
 * Get which player should play next in the current trick
 */
export function getNextPlayer(trick: Trick, leadPlayer: number): number {
  const cardsPlayed = trick.cards.length
  return (leadPlayer + cardsPlayed) % 4
}

/**
 * Check if a player is sitting out (partner of alone player)
 */
export function isPlayerSittingOut(
  playerId: number,
  alonePlayer: number | null
): boolean {
  if (alonePlayer === null) {
    return false
  }

  // Partner sits across (differ by 2)
  const partnerId = (alonePlayer + 2) % 4
  return playerId === partnerId
}
