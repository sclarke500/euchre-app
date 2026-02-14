// Spades bidding logic

import { Suit, FullRank } from '../core/types.js'
import type { StandardCard } from '../core/types.js'
import { SpadesBidType, type SpadesBid, type SpadesPlayer } from './types.js'

/**
 * Validate a bid
 */
export function isValidBid(bid: SpadesBid, hand: StandardCard[]): boolean {
  switch (bid.type) {
    case SpadesBidType.Normal:
      return bid.count >= 0 && bid.count <= 13
    case SpadesBidType.Nil:
      return bid.count === 0
    case SpadesBidType.BlindNil:
      // Blind nil must be bid before seeing cards - we trust this is enforced by game flow
      return bid.count === 0
    default:
      return false
  }
}

/**
 * Create a normal bid
 */
export function createBid(count: number): SpadesBid {
  return { type: SpadesBidType.Normal, count }
}

/**
 * Create a nil bid
 */
export function createNilBid(): SpadesBid {
  return { type: SpadesBidType.Nil, count: 0 }
}

/**
 * Create a blind nil bid
 */
export function createBlindNilBid(): SpadesBid {
  return { type: SpadesBidType.BlindNil, count: 0 }
}

/**
 * Count cards by suit in a hand
 */
export function countSuits(hand: StandardCard[]): Record<Suit, number> {
  const counts: Record<Suit, number> = {
    [Suit.Hearts]: 0,
    [Suit.Diamonds]: 0,
    [Suit.Clubs]: 0,
    [Suit.Spades]: 0,
  }

  for (const card of hand) {
    counts[card.suit]++
  }

  return counts
}

/**
 * Count high cards (A, K, Q) in hand
 */
export function countHighCards(hand: StandardCard[]): number {
  const highRanks = [FullRank.Ace, FullRank.King, FullRank.Queen]
  return hand.filter(c => highRanks.includes(c.rank)).length
}

/**
 * Count spades in hand
 */
export function countSpades(hand: StandardCard[]): number {
  return hand.filter(c => c.suit === Suit.Spades).length
}

/**
 * Count high spades (A, K, Q) in hand
 */
export function countHighSpades(hand: StandardCard[]): number {
  const highRanks = [FullRank.Ace, FullRank.King, FullRank.Queen]
  return hand.filter(c => c.suit === Suit.Spades && highRanks.includes(c.rank)).length
}

/**
 * Count voids (suits with 0 cards)
 */
export function countVoids(hand: StandardCard[]): number {
  const suits = countSuits(hand)
  return Object.values(suits).filter(count => count === 0).length
}

/**
 * Estimate tricks for a hand (simple heuristic)
 */
export function estimateTricks(hand: StandardCard[]): number {
  let tricks = 0

  // High spades are almost guaranteed tricks
  tricks += countHighSpades(hand)

  // Count other high cards (may or may not take tricks)
  const highCards = countHighCards(hand)
  const highSpades = countHighSpades(hand)
  const otherHighCards = highCards - highSpades

  // Non-spade aces are usually good for a trick
  const nonSpadeAces = hand.filter(
    c => c.rank === FullRank.Ace && c.suit !== Suit.Spades
  ).length
  tricks += nonSpadeAces

  // Kings in long suits might take tricks
  const nonSpadeKings = hand.filter(
    c => c.rank === FullRank.King && c.suit !== Suit.Spades
  ).length
  tricks += Math.floor(nonSpadeKings * 0.6)

  // Low spades can take tricks if opponent is void
  const lowSpades = countSpades(hand) - highSpades
  tricks += Math.floor(lowSpades * 0.3)

  // Voids help us trump in
  const voids = countVoids(hand)
  tricks += Math.floor(voids * 0.5)

  // Don't bid more than 13
  return Math.min(Math.round(tricks), 13)
}

/**
 * Check if a hand is suitable for nil bid
 */
export function isNilCandidate(hand: StandardCard[]): boolean {
  // No high spades
  if (countHighSpades(hand) > 0) return false

  // Very few spades overall
  if (countSpades(hand) > 3) return false

  // No aces in other suits
  const nonSpadeAces = hand.filter(
    c => c.rank === FullRank.Ace && c.suit !== Suit.Spades
  ).length
  if (nonSpadeAces > 0) return false

  // Few high cards overall
  if (countHighCards(hand) > 2) return false

  return true
}

/**
 * Get bid display text
 */
export function getBidDisplayText(bid: SpadesBid): string {
  switch (bid.type) {
    case SpadesBidType.Nil:
      return 'Nil'
    case SpadesBidType.BlindNil:
      return 'Blind Nil'
    case SpadesBidType.Normal:
      return bid.count.toString()
    default:
      return '?'
  }
}

/**
 * Get team's total bid for display
 */
export function getTeamBidDisplay(players: SpadesPlayer[], teamId: number): string {
  const teamPlayers = players.filter(p => p.teamId === teamId)
  const bids = teamPlayers
    .map(p => p.bid)
    .filter((b): b is SpadesBid => b !== null)

  if (bids.length === 0) return '—'
  if (bids.length === 1) {
    return getBidDisplayText(bids[0]!)
  }

  // Both players have bid
  const nilBids = bids.filter(b => b.type !== SpadesBidType.Normal)
  const normalBids = bids.filter(b => b.type === SpadesBidType.Normal)

  let display = ''

  // Show combined normal bids
  if (normalBids.length > 0) {
    const total = normalBids.reduce((sum, b) => sum + b.count, 0)
    display = total.toString()
  }

  // Append nil bids
  for (const nil of nilBids) {
    const text = nil.type === SpadesBidType.BlindNil ? 'BN' : 'N'
    display = display ? `${display} + ${text}` : text
  }

  return display
}
