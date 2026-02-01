import type { Card, Player, Trick, Suit, Bid } from './game.js'
import { BidAction, Rank, Suit as SuitEnum } from './game.js'
import { getLegalPlays, getEffectiveSuit } from './trick.js'
import { compareCards, getCardValue, getSameColorSuit } from './deck.js'
import { shouldOrderUp, chooseSuitRound2, shouldGoAlone } from './trump.js'

/**
 * Tracks game state for smarter AI decisions
 * Should be created once per round and updated as cards are played
 */
export class GameTracker {
  private playedCards: Set<string> = new Set()
  private playerVoids: Map<number, Set<Suit>> = new Map()
  private trump: Suit | null = null

  constructor() {
    // Initialize void tracking for all 4 players
    for (let i = 0; i < 4; i++) {
      this.playerVoids.set(i, new Set())
    }
  }

  /**
   * Reset tracker for a new round
   */
  reset(): void {
    this.playedCards.clear()
    this.trump = null
    for (let i = 0; i < 4; i++) {
      this.playerVoids.get(i)!.clear()
    }
  }

  /**
   * Set the trump suit for this round
   */
  setTrump(trump: Suit): void {
    this.trump = trump
  }

  /**
   * Record a card being played
   */
  recordCardPlayed(card: Card, playerId: number, leadingSuit: Suit | null): void {
    this.playedCards.add(card.id)

    // Track voids - if player didn't follow suit, they're void
    if (leadingSuit && this.trump) {
      const effectiveSuit = getEffectiveSuit(card, this.trump)
      if (effectiveSuit !== leadingSuit) {
        this.playerVoids.get(playerId)!.add(leadingSuit)
      }
    }
  }

  /**
   * Record all cards in a completed trick
   */
  recordTrick(trick: Trick): void {
    if (!trick.leadingSuit) return

    for (const playedCard of trick.cards) {
      this.recordCardPlayed(playedCard.card, playedCard.playerId, trick.leadingSuit)
    }
  }

  /**
   * Check if a card has been played
   */
  isCardPlayed(cardId: string): boolean {
    return this.playedCards.has(cardId)
  }

  /**
   * Check if a player is void in a suit
   */
  isPlayerVoid(playerId: number, suit: Suit): boolean {
    return this.playerVoids.get(playerId)?.has(suit) ?? false
  }

  /**
   * Check if the right bower has been played
   */
  isRightBowerPlayed(): boolean {
    if (!this.trump) return false
    return this.playedCards.has(`${this.trump}-J`)
  }

  /**
   * Check if the left bower has been played
   */
  isLeftBowerPlayed(): boolean {
    if (!this.trump) return false
    const leftBowerSuit = getSameColorSuit(this.trump)
    return this.playedCards.has(`${leftBowerSuit}-J`)
  }

  /**
   * Check if both bowers have been played (making off-suit aces safe)
   */
  areBothBowersPlayed(): boolean {
    return this.isRightBowerPlayed() && this.isLeftBowerPlayed()
  }

  /**
   * Count how many trump cards have been played
   */
  getTrumpPlayedCount(): number {
    if (!this.trump) return 0

    let count = 0
    const leftBowerSuit = getSameColorSuit(this.trump)

    for (const cardId of this.playedCards) {
      const [suit, rank] = cardId.split('-')
      // Trump suit cards (including right bower)
      if (suit === this.trump) {
        count++
      }
      // Left bower
      else if (suit === leftBowerSuit && rank === 'J') {
        count++
      }
    }

    return count
  }

  /**
   * Estimate remaining trump in opponents' hands
   * Total trump = 7 (6 in trump suit + left bower)
   */
  estimateRemainingTrump(myTrumpCount: number, partnerTrumpCount: number = 0): number {
    const totalTrump = 7
    const trumpPlayed = this.getTrumpPlayedCount()
    return totalTrump - trumpPlayed - myTrumpCount - partnerTrumpCount
  }

  /**
   * Check if an off-suit ace is likely safe to lead
   */
  isOffSuitAceSafe(suit: Suit, playerId: number): boolean {
    if (!this.trump) return false
    if (suit === this.trump) return false

    // Get opponents
    const opponent1 = (playerId + 1) % 4
    const opponent2 = (playerId + 3) % 4

    // If both opponents are void in this suit, they can trump it
    const opp1Void = this.isPlayerVoid(opponent1, suit)
    const opp2Void = this.isPlayerVoid(opponent2, suit)

    // If either opponent is void, ace is risky
    if (opp1Void || opp2Void) {
      // But if both bowers are played and opponents might be out of trump, it could be OK
      if (this.areBothBowersPlayed() && this.getTrumpPlayedCount() >= 5) {
        return true
      }
      return false
    }

    return true
  }
}

// Global tracker instance - should be managed by game logic
let globalTracker: GameTracker | null = null

/**
 * Get or create the game tracker
 */
export function getTracker(): GameTracker {
  if (!globalTracker) {
    globalTracker = new GameTracker()
  }
  return globalTracker
}

/**
 * Reset the tracker for a new round
 */
export function resetTracker(): void {
  if (globalTracker) {
    globalTracker.reset()
  }
}

/**
 * AI makes a bidding decision for round 1 (turn card)
 * Same as easy AI for now - bidding logic is already decent
 */
export function makeAIBidRound1Hard(
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
export function makeAIBidRound2Hard(
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

  return {
    playerId: player.id,
    action: BidAction.Pass,
  }
}

/**
 * AI chooses which card to play with card tracking
 */
export function chooseCardToPlayHard(
  player: Player,
  trick: Trick,
  trump: Suit,
  partnerWinning: boolean,
  tracker: GameTracker
): Card {
  const legalPlays = getLegalPlays(player.hand, trick, trump)

  if (legalPlays.length === 0) {
    throw new Error('No legal plays available')
  }

  if (legalPlays.length === 1) {
    return legalPlays[0]!
  }

  // Ensure tracker knows the trump
  tracker.setTrump(trump)

  // Leading the trick
  if (trick.cards.length === 0) {
    return chooseLeadCardHard(legalPlays, trump, player.id, tracker)
  }

  // Following in the trick
  return chooseFollowCardHard(legalPlays, trick, trump, partnerWinning, player.id, tracker)
}

/**
 * Choose which card to lead with (hard AI)
 */
function chooseLeadCardHard(
  legalPlays: Card[],
  trump: Suit,
  playerId: number,
  tracker: GameTracker
): Card {
  const trumpCards = legalPlays.filter((c) => getEffectiveSuit(c, trump) === trump)
  const nonTrumpCards = legalPlays.filter((c) => getEffectiveSuit(c, trump) !== trump)

  // Count my trump
  const myTrumpCount = trumpCards.length

  // Estimate opponents' remaining trump
  const estimatedOpponentTrump = tracker.estimateRemainingTrump(myTrumpCount)

  // Strategy 1: If I have more trump than likely remaining, lead trump to drain them
  if (myTrumpCount >= 2 && myTrumpCount > estimatedOpponentTrump) {
    // Lead lowest trump to draw them out while conserving high trump
    return getLowestCard(trumpCards, trump, null)!
  }

  // Strategy 2: If I have the right bower, lead it to establish dominance
  const rightBower = trumpCards.find((c) => c.rank === Rank.Jack && c.suit === trump)
  if (rightBower && myTrumpCount >= 2) {
    return rightBower
  }

  // Strategy 3: Lead safe off-suit aces
  if (nonTrumpCards.length > 0) {
    const safeAces = nonTrumpCards.filter(
      (c) => c.rank === Rank.Ace && tracker.isOffSuitAceSafe(c.suit, playerId)
    )
    if (safeAces.length > 0) {
      return safeAces[0]!
    }
  }

  // Strategy 4: If both bowers are gone, off-suit aces are winners
  if (tracker.areBothBowersPlayed() && nonTrumpCards.length > 0) {
    const aces = nonTrumpCards.filter((c) => c.rank === Rank.Ace)
    if (aces.length > 0) {
      return aces[0]!
    }
  }

  // Strategy 5: Lead from a suit where opponents might be void (risky but can draw trump)
  // Skip this for now - too advanced

  // Strategy 6: Lead highest non-trump (basic strategy)
  if (nonTrumpCards.length > 0) {
    return getHighestCard(nonTrumpCards, trump, null)!
  }

  // Only trump left, lead highest
  return getHighestCard(trumpCards, trump, null)!
}

/**
 * Choose which card to follow with (hard AI)
 */
function chooseFollowCardHard(
  legalPlays: Card[],
  trick: Trick,
  trump: Suit,
  partnerWinning: boolean,
  playerId: number,
  tracker: GameTracker
): Card {
  const currentWinningCard = getCurrentWinningCard(trick, trump)

  // If partner is winning
  if (partnerWinning) {
    // Check if we're last to play - if so, definitely play lowest
    if (trick.cards.length === 3) {
      return getLowestCard(legalPlays, trump, trick.leadingSuit)!
    }

    // Check if remaining opponent might beat partner
    const remainingOpponent = (playerId + 1) % 4
    const opponentVoidInLead = trick.leadingSuit
      ? tracker.isPlayerVoid(remainingOpponent, trick.leadingSuit)
      : false

    // If opponent is void in lead suit, they might trump - consider overtrumping partner
    if (opponentVoidInLead) {
      const myTrumps = legalPlays.filter((c) => getEffectiveSuit(c, trump) === trump)
      const highTrumps = myTrumps.filter(
        (c) => compareCards(c, currentWinningCard, trump, trick.leadingSuit) > 0
      )

      // If I have a high trump that can beat any remaining trump, play it
      if (highTrumps.length > 0 && tracker.getTrumpPlayedCount() >= 4) {
        return getLowestCard(highTrumps, trump, trick.leadingSuit)!
      }
    }

    // Partner winning and opponent unlikely to beat - play lowest
    return getLowestCard(legalPlays, trump, trick.leadingSuit)!
  }

  // Try to win the trick with the lowest winning card
  const winningCards = legalPlays.filter((card) =>
    compareCards(card, currentWinningCard, trump, trick.leadingSuit) > 0
  )

  if (winningCards.length > 0) {
    // If we're last to play, just play lowest winner
    if (trick.cards.length === 3) {
      return getLowestCard(winningCards, trump, trick.leadingSuit)!
    }

    // Consider if the remaining player might beat our card
    const remainingOpponent = (playerId + 1) % 4
    const opponentVoidInLead = trick.leadingSuit
      ? tracker.isPlayerVoid(remainingOpponent, trick.leadingSuit)
      : false

    if (opponentVoidInLead) {
      // Opponent might trump - need to play high enough to beat potential trump
      // For now, just play lowest winner and hope for the best
      return getLowestCard(winningCards, trump, trick.leadingSuit)!
    }

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
export function isPartnerWinningHard(
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

  const partnerId = (playerId + 2) % 4
  return winningPlayerId === partnerId
}

/**
 * Dealer discards a card after picking up (same as easy AI)
 */
export function chooseDealerDiscardHard(hand: Card[], trump: Suit): Card {
  const nonTrumpCards = hand.filter((c) => getEffectiveSuit(c, trump) !== trump)

  if (nonTrumpCards.length > 0) {
    const card = getLowestCard(nonTrumpCards, trump, null)
    if (card) return card
  }

  const card = getLowestCard(hand, trump, null)
  if (!card) throw new Error('No cards in hand to discard')
  return card
}
