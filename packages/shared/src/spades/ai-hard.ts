// Spades Hard AI — uses card tracking, position-aware play, and strategic heuristics

import { Suit, FullRank } from '../core/types.js'
import type { StandardCard } from '../core/types.js'
import {
  SpadesBidType,
  type SpadesGameState,
  type SpadesPlayer,
  type SpadesBid,
  type SpadesTrick,
} from './types.js'
import { createBid, createNilBid, countSuits } from './bidding.js'
import { getLegalPlays, getSpadesCardValue } from './tricks.js'

// All spade card IDs for tracking
const ALL_SPADE_IDS = [
  'spades-2', 'spades-3', 'spades-4', 'spades-5', 'spades-6', 'spades-7',
  'spades-8', 'spades-9', 'spades-10', 'spades-J', 'spades-Q', 'spades-K', 'spades-A',
]

/**
 * Tracks played cards and player voids across a round for smarter decisions.
 */
export class SpadesTracker {
  private playedCards: Set<string> = new Set()
  private playerVoids: Map<number, Set<Suit>> = new Map()

  constructor() {
    for (let i = 0; i < 4; i++) {
      this.playerVoids.set(i, new Set())
    }
  }

  reset(): void {
    this.playedCards.clear()
    for (let i = 0; i < 4; i++) {
      this.playerVoids.get(i)!.clear()
    }
  }

  recordCardPlayed(card: StandardCard, playerId: number, leadingSuit: Suit | null): void {
    this.playedCards.add(card.id)

    // If player didn't follow suit, they're void in that suit
    if (leadingSuit && card.suit !== leadingSuit) {
      this.playerVoids.get(playerId)!.add(leadingSuit)
    }
  }

  recordTrick(trick: SpadesTrick): void {
    if (!trick.leadingSuit) return
    for (const played of trick.cards) {
      this.recordCardPlayed(played.card, played.playerId, trick.leadingSuit)
    }
  }

  isCardPlayed(cardId: string): boolean {
    return this.playedCards.has(cardId)
  }

  isPlayerVoid(playerId: number, suit: Suit): boolean {
    return this.playerVoids.get(playerId)?.has(suit) ?? false
  }

  /** Count spades that haven't been played yet (excluding cards in myHand) */
  spadesRemaining(myHand: StandardCard[]): number {
    const mySpadeIds = new Set(myHand.filter(c => c.suit === Suit.Spades).map(c => c.id))
    return ALL_SPADE_IDS.filter(id => !this.playedCards.has(id) && !mySpadeIds.has(id)).length
  }

  /** Check if a specific rank of spades has been played */
  isSpadePlayed(rank: FullRank): boolean {
    return this.playedCards.has(`spades-${rank}`)
  }

  /** Check if my card is the highest remaining in its suit */
  isHighestRemaining(card: StandardCard, myHand: StandardCard[]): boolean {
    const rankOrder = [
      FullRank.Two, FullRank.Three, FullRank.Four, FullRank.Five, FullRank.Six,
      FullRank.Seven, FullRank.Eight, FullRank.Nine, FullRank.Ten,
      FullRank.Jack, FullRank.Queen, FullRank.King, FullRank.Ace,
    ]
    const myIdx = rankOrder.indexOf(card.rank)
    const myHandIds = new Set(myHand.map(c => c.id))

    // Check if any higher card in the same suit is still unplayed and not in my hand
    for (let i = myIdx + 1; i < rankOrder.length; i++) {
      const id = `${card.suit}-${rankOrder[i]}`
      if (!this.playedCards.has(id) && !myHandIds.has(id)) {
        return false // a higher card is still out there
      }
    }
    return true
  }

  /** Check if either opponent is void in a suit */
  isOpponentVoid(playerId: number, suit: Suit): boolean {
    const opp1 = (playerId + 1) % 4
    const opp3 = (playerId + 3) % 4
    return this.isPlayerVoid(opp1, suit) || this.isPlayerVoid(opp3, suit)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLowest(cards: StandardCard[], leadingSuit: Suit | null): StandardCard {
  return cards.reduce((low, card) => {
    return getSpadesCardValue(card, leadingSuit) < getSpadesCardValue(low, leadingSuit) ? card : low
  })
}

function getHighest(cards: StandardCard[], leadingSuit: Suit | null): StandardCard {
  return cards.reduce((high, card) => {
    return getSpadesCardValue(card, leadingSuit) > getSpadesCardValue(high, leadingSuit) ? card : high
  })
}

/** Current winning value of the trick */
function trickWinningValue(trick: SpadesTrick): number {
  let best = 0
  for (const played of trick.cards) {
    const v = getSpadesCardValue(played.card, trick.leadingSuit)
    if (v > best) best = v
  }
  return best
}

/** Current winning player of the trick */
function trickWinnerId(trick: SpadesTrick): number | null {
  if (trick.cards.length === 0) return null
  let best = trick.cards[0]!
  for (const played of trick.cards) {
    if (getSpadesCardValue(played.card, trick.leadingSuit) > getSpadesCardValue(best.card, trick.leadingSuit)) {
      best = played
    }
  }
  return best.playerId
}

function partnerId(playerId: number): number {
  return (playerId + 2) % 4
}

function isPartnerCurrentlyWinning(trick: SpadesTrick, playerId: number): boolean {
  return trickWinnerId(trick) === partnerId(playerId)
}

/** Cards in legalPlays that beat the current trick winner */
function getWinners(legalPlays: StandardCard[], trick: SpadesTrick): StandardCard[] {
  const winVal = trickWinningValue(trick)
  return legalPlays.filter(c => getSpadesCardValue(c, trick.leadingSuit) > winVal)
}

/** Cheapest card that still beats the current trick */
function cheapestWinner(legalPlays: StandardCard[], trick: SpadesTrick): StandardCard | null {
  const winners = getWinners(legalPlays, trick)
  if (winners.length === 0) return null
  return getLowest(winners, trick.leadingSuit)
}

function seatPosition(trick: SpadesTrick): number {
  return trick.cards.length // 0=lead, 1=2nd, 2=3rd, 3=4th
}

// ---------------------------------------------------------------------------
// BIDDING
// ---------------------------------------------------------------------------

/**
 * Improved trick estimation for bidding.
 */
export function estimateTricksHard(hand: StandardCard[]): number {
  let tricks = 0
  const suits = countSuits(hand)
  const bySuit: Record<Suit, StandardCard[]> = {
    [Suit.Hearts]: [],
    [Suit.Diamonds]: [],
    [Suit.Clubs]: [],
    [Suit.Spades]: [],
  }
  for (const c of hand) bySuit[c.suit].push(c)

  // --- Spade evaluation ---
  const spades = bySuit[Suit.Spades]
  for (const c of spades) {
    switch (c.rank) {
      case FullRank.Ace:   tricks += 1.0; break
      case FullRank.King:  tricks += 0.9; break
      case FullRank.Queen: tricks += 0.7; break
      case FullRank.Jack:  tricks += 0.4; break
    }
  }
  // Length tricks: each spade beyond the 3rd
  const spadeLengthTricks = Math.max(0, spades.length - 3)
  tricks += spadeLengthTricks * 0.5

  // --- Off-suit evaluation ---
  for (const suit of [Suit.Hearts, Suit.Diamonds, Suit.Clubs]) {
    const suitCards = bySuit[suit]
    const len = suitCards.length

    for (const c of suitCards) {
      if (c.rank === FullRank.Ace) {
        tricks += len >= 2 ? 1.0 : 0.7 // singleton ace is riskier
      } else if (c.rank === FullRank.King) {
        tricks += len >= 3 ? 0.7 : (len === 2 ? 0.5 : 0.3)
      } else if (c.rank === FullRank.Queen) {
        // Queen is only valuable if protected by A or K in same suit
        const hasHigher = suitCards.some(s => s.rank === FullRank.Ace || s.rank === FullRank.King)
        tricks += hasHigher ? 0.4 : 0.1
      }
    }

    // Void = ruffing opportunity
    if (len === 0) {
      // Only count if we have spades to ruff with
      if (spades.length > 0) tricks += 1.0
    } else if (len === 1) {
      if (spades.length > 0) tricks += 0.5
    }
  }

  return Math.min(Math.round(tricks), 13)
}

/**
 * Enhanced nil suitability score (higher = better nil candidate).
 * Returns a numeric score; threshold around 5-6 means good nil.
 */
function nilScore(hand: StandardCard[]): number {
  let score = 0
  const bySuit: Record<Suit, StandardCard[]> = {
    [Suit.Hearts]: [],
    [Suit.Diamonds]: [],
    [Suit.Clubs]: [],
    [Suit.Spades]: [],
  }
  for (const c of hand) bySuit[c.suit].push(c)

  // Heavy penalties for high spades
  for (const c of bySuit[Suit.Spades]) {
    if (c.rank === FullRank.Ace)   score -= 5
    if (c.rank === FullRank.King)  score -= 4
    if (c.rank === FullRank.Queen) score -= 3
    if (c.rank === FullRank.Jack)  score -= 2
  }

  // Penalize spade length
  score -= Math.max(0, bySuit[Suit.Spades].length - 2) * 2

  // Penalize off-suit aces and kings
  for (const suit of [Suit.Hearts, Suit.Diamonds, Suit.Clubs]) {
    for (const c of bySuit[suit]) {
      if (c.rank === FullRank.Ace)  score -= 3
      if (c.rank === FullRank.King) score -= 2
    }
  }

  // Reward voids
  for (const suit of [Suit.Hearts, Suit.Diamonds, Suit.Clubs]) {
    if (bySuit[suit].length === 0) score += 3
  }

  // Reward low cards (2-6)
  const lowRanks = [FullRank.Two, FullRank.Three, FullRank.Four, FullRank.Five, FullRank.Six]
  for (const c of hand) {
    if (lowRanks.includes(c.rank)) score += 1
  }

  return score
}

/**
 * Adjust bid based on score position and bag status
 */
function adjustBidForScoreAndBags(estimate: number, teamScore: number, opponentScore: number, teamBags: number): number {
  let adjusted = estimate

  // More aggressive when behind by more than 100
  if (teamScore < opponentScore - 100) {
    adjusted = Math.min(adjusted + 1, 13)
  }
  // Conservative when leading comfortably
  else if (teamScore > opponentScore + 100) {
    adjusted = Math.max(adjusted - 1, 1)
  }

  // Avoid bags when close to 10 (7+ bags)
  if (teamBags >= 7 && adjusted > 0) {
    adjusted = Math.max(adjusted - 1, 1)
  }

  return adjusted
}

/**
 * Hard AI bidding — deterministic estimation with position and score awareness.
 */
export function chooseSpadesBidHard(
  player: SpadesPlayer,
  gameState: SpadesGameState
): SpadesBid {
  const hand = player.hand
  const teamScore = gameState.scores[player.teamId]?.score ?? 0
  const opponentScore = gameState.scores[1 - player.teamId]?.score ?? 0
  const teamBags = gameState.scores[player.teamId]?.bags ?? 0

  // --- Nil evaluation ---
  const ns = nilScore(hand)
  const hasAceOfSpades = hand.some(c => c.suit === Suit.Spades && c.rank === FullRank.Ace)
  const hasKingOfSpades = hand.some(c => c.suit === Suit.Spades && c.rank === FullRank.King)

  // Never nil with A♠ or K♠
  if (!hasAceOfSpades && !hasKingOfSpades) {
    // More willing when behind
    const nilThreshold = teamScore < opponentScore - 100 ? 3 : 5
    if (ns >= nilThreshold) {
      // Check partner's bid — prefer nil if partner bid high (can cover)
      const partner = gameState.players.find(p => p.teamId === player.teamId && p.id !== player.id)
      const partnerBidHigh = partner?.bid && partner.bid.type === SpadesBidType.Normal && partner.bid.count >= 4
      if (ns >= 7 || partnerBidHigh || teamScore < opponentScore - 100) {
        return createNilBid()
      }
    }
  }

  // --- Normal bid estimation ---
  let estimate = estimateTricksHard(hand)

  // Partner adjustments
  const partner = gameState.players.find(p => p.teamId === player.teamId && p.id !== player.id)
  if (partner?.bid) {
    if (partner.bid.type !== SpadesBidType.Normal) {
      // Partner bid nil — we'll win extra tricks covering them
      estimate = Math.min(estimate + 1, 13)
    } else if (partner.bid.count >= 5) {
      // Partner bid high — be slightly conservative to avoid overbidding as a team
      estimate = Math.max(estimate - 1, 0)
    }
  }

  // Position awareness: if we're last to bid and total would exceed 13, reduce
  const bidsSoFar = gameState.players
    .filter(p => p.bid !== null && p.bid.type === SpadesBidType.Normal)
    .reduce((sum, p) => sum + p.bid!.count, 0)
  const allOthersBid = gameState.players.filter(p => p.id !== player.id).every(p => p.bid !== null)
  if (allOthersBid && bidsSoFar + estimate > 13) {
    estimate = Math.max(estimate - 1, 1)
  }

  // Apply score and bag adjustments
  estimate = adjustBidForScoreAndBags(estimate, teamScore, opponentScore, teamBags)

  // Never bid 0 unless nil (bid at least 1)
  estimate = Math.max(estimate, 1)

  return createBid(estimate)
}

// ---------------------------------------------------------------------------
// CARD PLAY
// ---------------------------------------------------------------------------

/**
 * Check if we should cash an ace early
 */
function shouldCashAce(card: StandardCard, tracker: SpadesTracker, playerId: number, trickNumber: number): boolean {
  if (card.rank !== FullRank.Ace) return false
  // Cash safe aces early (tricks 1-4)
  if (trickNumber <= 4 && !tracker.isOpponentVoid(playerId, card.suit)) {
    return true
  }
  return false
}

/**
 * Enhanced nil attacking strategy
 */
function attackNilOpponent(legalPlays: StandardCard[], opponentNil: SpadesPlayer, tracker: SpadesTracker): StandardCard | null {
  // Lead suits opponent is NOT void in
  for (const suit of [Suit.Hearts, Suit.Diamonds, Suit.Clubs]) {
    if (!tracker.isPlayerVoid(opponentNil.id, suit)) {
      const suitCards = legalPlays.filter(c => c.suit === suit)
      if (suitCards.length > 0) {
        return getLowest(suitCards, null) // Lead low to force following
      }
    }
  }
  return null
}

/**
 * Endgame adjustment based on remaining tricks
 */
function endgameAdjustment(needTricks: boolean, tricksRemaining: number, teamTricksNeeded: number): 'aggressive' | 'conservative' | 'normal' {
  if (tricksRemaining <= teamTricksNeeded) {
    return needTricks ? 'aggressive' : 'conservative'
  }
  return 'normal'
}

/**
 * Hard AI card play — position-aware, tracking-based, with nil/bag strategies.
 */
export function chooseSpadesCardHard(
  player: SpadesPlayer,
  gameState: SpadesGameState,
  tracker: SpadesTracker
): StandardCard {
  const hand = player.hand
  const trick = gameState.currentTrick
  const legalPlays = getLegalPlays(hand, trick, gameState.spadesBroken)

  if (legalPlays.length <= 1) {
    return legalPlays[0]!
  }

  // Nil bidder — try to lose
  if (player.bid?.type === SpadesBidType.Nil || player.bid?.type === SpadesBidType.BlindNil) {
    return playForNilHard(legalPlays, trick, tracker, player.id)
  }

  // Check if partner bid nil — we need to cover them
  const partner = gameState.players.find(p => p.teamId === player.teamId && p.id !== player.id)
  const partnerBidNil = partner?.bid?.type === SpadesBidType.Nil || partner?.bid?.type === SpadesBidType.BlindNil

  // Check if an opponent bid nil — we want to attack them
  const opponentNilBidder = gameState.players.find(
    p => p.teamId !== player.teamId &&
      (p.bid?.type === SpadesBidType.Nil || p.bid?.type === SpadesBidType.BlindNil)
  )

  // Team bid/tricks tracking
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
  const teamBags = gameState.scores[player.teamId]?.bags ?? 0
  const shouldAvoidBags = !needMoreTricks && teamBags >= 7
  const trickNumber = gameState.completedTricks.length + 1 // 1-indexed
  const tricksRemaining = 13 - gameState.completedTricks.length
  const teamTricksNeeded = Math.max(0, teamBid - teamTricks)
  const endgameStrategy = endgameAdjustment(needMoreTricks, tricksRemaining, teamTricksNeeded)

  // LEADING
  if (trick.cards.length === 0) {
    return leadCardHard(
      legalPlays, hand, gameState, player.id, tracker,
      needMoreTricks, shouldAvoidBags, partnerBidNil, opponentNilBidder, trickNumber, endgameStrategy
    )
  }

  // FOLLOWING
  return followCardHard(
    legalPlays, trick, hand, player.id, tracker,
    needMoreTricks, shouldAvoidBags, partnerBidNil, trickNumber, endgameStrategy
  )
}

// ---------------------------------------------------------------------------
// LEADING
// ---------------------------------------------------------------------------

function leadCardHard(
  legalPlays: StandardCard[],
  hand: StandardCard[],
  gameState: SpadesGameState,
  playerId: number,
  tracker: SpadesTracker,
  needTricks: boolean,
  avoidBags: boolean,
  partnerBidNil: boolean,
  opponentNil: SpadesPlayer | undefined,
  trickNumber: number,
  endgameStrategy: 'aggressive' | 'conservative' | 'normal',
): StandardCard {
  const nonSpades = legalPlays.filter(c => c.suit !== Suit.Spades)
  const spades = legalPlays.filter(c => c.suit !== Suit.Spades ? false : true)

  // --- Covering partner's nil: lead suits partner is void in ---
  if (partnerBidNil) {
    const pid = partnerId(playerId)
    for (const suit of [Suit.Hearts, Suit.Diamonds, Suit.Clubs]) {
      if (tracker.isPlayerVoid(pid, suit)) {
        const suitCards = legalPlays.filter(c => c.suit === suit)
        if (suitCards.length > 0) {
          // Lead high in this suit — we want to win it and let partner dump
          return getHighest(suitCards, null)
        }
      }
    }
    // Lead from strongest suit to maintain control
    const strong = nonSpades.filter(c =>
      c.rank === FullRank.Ace || c.rank === FullRank.King
    )
    if (strong.length > 0) return strong[0]!
  }

  // --- Attacking opponent's nil: lead their short/dangerous suits ---
  if (opponentNil) {
    const attackCard = attackNilOpponent(legalPlays, opponentNil, tracker)
    if (attackCard) return attackCard
  }

  // --- Avoid bags: lead low garbage to lose the trick ---
  if (avoidBags) {
    if (nonSpades.length > 0) {
      return getLowest(nonSpades, null)
    }
    return getLowest(legalPlays, null)
  }

  // --- Need tricks ---
  if (needTricks) {
    // Cash safe aces early
    const safeAces = legalPlays.filter(c => shouldCashAce(c, tracker, playerId, trickNumber))
    if (safeAces.length > 0) return safeAces[0]!

    // Cash any ace that's guaranteed (highest remaining in suit)
    const masterCards = nonSpades.filter(c => tracker.isHighestRemaining(c, hand))
    if (masterCards.length > 0) return masterCards[0]!

    // Pull trump with 5+ spades
    if (spades.length >= 5) {
      return getHighest(spades, null)
    }

    // Lead high spade if it's master
    const masterSpades = spades.filter(c => tracker.isHighestRemaining(c, hand))
    if (masterSpades.length > 0) return masterSpades[0]!

    // Lead from longest non-spade suit (high card)
    if (nonSpades.length > 0) {
      const bySuit: Partial<Record<Suit, StandardCard[]>> = {}
      for (const c of nonSpades) {
        ;(bySuit[c.suit] ??= []).push(c)
      }
      let bestSuit: Suit | null = null
      let bestCount = 0
      for (const [suit, cards] of Object.entries(bySuit) as [Suit, StandardCard[]][]) {
        if (cards.length > bestCount) {
          bestCount = cards.length
          bestSuit = suit
        }
      }
      if (bestSuit) {
        const suitCards = bySuit[bestSuit]!
        return getHighest(suitCards, null)
      }
    }

    // Only spades remain — lead highest
    if (spades.length > 0) return getHighest(spades, null)
  }

  // --- Don't need tricks: lead low from short non-spade suit ---
  if (nonSpades.length > 0) {
    // Prefer short suits (but avoid leading unsupported Q or J)
    const bySuit: Partial<Record<Suit, StandardCard[]>> = {}
    for (const c of nonSpades) {
      ;(bySuit[c.suit] ??= []).push(c)
    }
    let shortestSuit: Suit | null = null
    let shortestLen = 14
    for (const [suit, cards] of Object.entries(bySuit) as [Suit, StandardCard[]][]) {
      if (cards.length < shortestLen) {
        shortestLen = cards.length
        shortestSuit = suit
      }
    }
    if (shortestSuit) {
      return getLowest(bySuit[shortestSuit]!, null)
    }
  }

  // Only spades — lead lowest
  return getLowest(legalPlays, null)
}

// ---------------------------------------------------------------------------
// FOLLOWING
// ---------------------------------------------------------------------------

function followCardHard(
  legalPlays: StandardCard[],
  trick: SpadesTrick,
  hand: StandardCard[],
  playerId: number,
  tracker: SpadesTracker,
  needTricks: boolean,
  avoidBags: boolean,
  partnerBidNil: boolean,
  trickNumber: number,
  endgameStrategy: 'aggressive' | 'conservative' | 'normal',
): StandardCard {
  const seat = seatPosition(trick) // 1=2nd, 2=3rd, 3=4th
  const partnerWinning = isPartnerCurrentlyWinning(trick, playerId)

  // Endgame adjustments
  if (endgameStrategy === 'aggressive' && needTricks) {
    // In endgame when we need tricks, be more aggressive about winning
    const winner = cheapestWinner(legalPlays, trick)
    if (winner) return winner
  } else if (endgameStrategy === 'conservative' && !needTricks) {
    // In endgame when we don't need tricks, be more conservative about dumping
    return getLowest(legalPlays, trick.leadingSuit)
  }

  // --- Partner bid nil and is currently winning (bad!) — overtake them ---
  if (partnerBidNil && isPartnerCurrentlyWinning(trick, playerId)) {
    const winner = cheapestWinner(legalPlays, trick)
    if (winner) return winner
  }

  // --- Avoid bags: if we don't need tricks and partner is winning, dump low ---
  if (avoidBags && partnerWinning) {
    return getLowest(legalPlays, trick.leadingSuit)
  }

  // --- 4th seat (last to play) ---
  if (seat === 3) {
    if (partnerWinning) {
      // Partner has it — play lowest
      return getLowest(legalPlays, trick.leadingSuit)
    }
    if (avoidBags && !needTricks) {
      // Don't need tricks and avoiding bags — dump
      return getLowest(legalPlays, trick.leadingSuit)
    }
    // Try to win as cheaply as possible
    const winner = cheapestWinner(legalPlays, trick)
    if (winner) return winner
    // Can't win — dump lowest
    return getLowest(legalPlays, trick.leadingSuit)
  }

  // --- 3rd seat (partner led) ---
  if (seat === 2) {
    if (partnerWinning) {
      // Partner's lead is winning — play low unless opponent after us might trump
      const nextOpp = (playerId + 1) % 4
      const oppVoidInLead = trick.leadingSuit ? tracker.isPlayerVoid(nextOpp, trick.leadingSuit) : false
      if (oppVoidInLead && needTricks) {
        // Opponent might trump — play high to try to prevent it
        const winner = cheapestWinner(legalPlays, trick)
        // Only play winner if it's a spade (higher than potential opponent trump)
        if (winner && winner.suit === Suit.Spades) return winner
      }
      return getLowest(legalPlays, trick.leadingSuit)
    }
    // Partner not winning (opponent is) — "third hand high", try to win
    if (needTricks || !avoidBags) {
      const winner = cheapestWinner(legalPlays, trick)
      if (winner) return winner
    }
    return getLowest(legalPlays, trick.leadingSuit)
  }

  // --- 2nd seat ---
  if (seat === 1) {
    // "Second hand low" — default play low
    if (partnerWinning) {
      // This shouldn't happen (only leader played, so partner can't be winning yet)
      // But just in case, play low
      return getLowest(legalPlays, trick.leadingSuit)
    }

    // Exception: if we have the guaranteed highest card and need tricks, take it
    if (needTricks) {
      const followingCards = legalPlays.filter(c => c.suit === trick.leadingSuit)
      if (followingCards.length > 0) {
        const best = getHighest(followingCards, trick.leadingSuit)
        if (tracker.isHighestRemaining(best, hand)) {
          return best // guaranteed winner, take the trick
        }
      }
    }

    // Default: play low (second hand low)
    return getLowest(legalPlays, trick.leadingSuit)
  }

  // Fallback
  return getLowest(legalPlays, trick.leadingSuit)
}

// ---------------------------------------------------------------------------
// NIL PLAY
// ---------------------------------------------------------------------------

function playForNilHard(
  legalPlays: StandardCard[],
  trick: SpadesTrick,
  tracker: SpadesTracker,
  playerId: number,
): StandardCard {
  // Leading as nil — lead lowest card overall
  if (trick.cards.length === 0) {
    return getLowest(legalPlays, null)
  }

  const winVal = trickWinningValue(trick)

  // Following: find highest card that still loses (save low cards for later)
  const losers = legalPlays.filter(c =>
    getSpadesCardValue(c, trick.leadingSuit) < winVal
  )

  if (losers.length > 0) {
    return getHighest(losers, trick.leadingSuit)
  }

  // We're forced to win — play lowest (minimize damage)
  return getLowest(legalPlays, trick.leadingSuit)
}
