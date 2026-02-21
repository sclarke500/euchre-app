// Spades game types

import type { Suit, FullRank, StandardCard, BasePlayer, PlayedCard } from '../core/types.js'

// Game phases for Spades
export enum SpadesPhase {
  Setup = 'setup',
  Dealing = 'dealing',
  Bidding = 'bidding',          // Players bid 0-13 (or Nil/Blind Nil)
  Playing = 'playing',
  TrickComplete = 'trick_complete',
  RoundComplete = 'round_complete',
  GameOver = 'game_over',
}

// Bid types
export enum SpadesBidType {
  Normal = 'normal',            // Standard bid (0-13)
  Nil = 'nil',                  // Bid to win 0 tricks (+100/-100)
  BlindNil = 'blind_nil',       // Bid 0 before seeing cards (+200/-200)
}

// A player's bid
export interface SpadesBid {
  type: SpadesBidType
  count: number                 // 0-13, always 0 for Nil/BlindNil
}

// Spades trick (similar to Euchre)
export interface SpadesTrick {
  cards: PlayedCard<FullRank>[]
  leadingSuit: Suit | null
  winnerId: number | null
}

// Spades-specific player
export interface SpadesPlayer extends BasePlayer {
  hand: StandardCard[]
  teamId: number                // 0 = North/South, 1 = East/West
  bid: SpadesBid | null         // Current round's bid
  tricksWon: number             // Tricks won this round
}

// Team state for a round
export interface SpadesTeamRoundState {
  teamId: number
  totalBid: number              // Combined bid of both partners
  tricksWon: number             // Tricks won this round
  bags: number                  // Accumulated bags (overtricks)
  madeNil: boolean[]            // Which players made their nil bid
  failedNil: boolean[]          // Which players failed their nil bid
}

// Team score tracking
export interface SpadesTeamScore {
  teamId: number
  score: number
  bags: number                  // Total accumulated bags (10 = -100 penalty)
}

// Full game state for Spades
export interface SpadesGameState {
  gameType: 'spades'
  players: SpadesPlayer[]
  phase: SpadesPhase
  currentTrick: SpadesTrick
  completedTricks: SpadesTrick[]
  currentPlayer: number         // Seat index of current player
  dealer: number                // Seat index of dealer
  scores: SpadesTeamScore[]     // Team scores
  roundNumber: number
  gameOver: boolean
  winner: number | null         // Winning team ID (0 or 1)
  
  // Spades-specific
  spadesBroken: boolean         // Can spades be led?
  bidsComplete: boolean         // All players have bid
  winScore: number              // Score to win (default 500)
  loseScore: number             // Score to lose (default -200)
}

// Actions a player can take
export enum SpadesAction {
  Bid = 'bid',
  PlayCard = 'play_card',
}

// A player's action
export interface SpadesPlayerAction {
  playerId: number
  action: SpadesAction
  bid?: SpadesBid               // For bid action
  card?: StandardCard           // For play action
}

// Round scoring result
export interface SpadesRoundScore {
  teamId: number
  baseBid: number               // The team's combined bid (excluding nil bids)
  tricksWon: number
  bagsPenalty: number           // -100 per 10 bags
  nilBonus: number              // +100/+200 per successful nil
  nilPenalty: number            // -100/-200 per failed nil
  roundPoints: number           // Total points for the round
}

// Client-side game state (hides other players' hands)
export interface SpadesClientGameState {
  gameType: 'spades'
  players: SpadesClientPlayer[]
  phase: SpadesPhase
  currentTrick: SpadesTrick
  completedTricks: SpadesTrick[]
  currentPlayer: number
  dealer: number
  scores: SpadesTeamScore[]
  roundNumber: number
  gameOver: boolean
  winner: number | null
  spadesBroken: boolean
  bidsComplete: boolean
  winScore: number
  loseScore: number
  stateSeq: number              // For sync tracking
  timedOutPlayer: number | null // Player who timed out (if any)
}

// Client-side player (hand only visible for own player)
export interface SpadesClientPlayer {
  id: number
  name: string
  avatar?: string               // User's selected avatar filename
  teamId: number
  bid: SpadesBid | null
  tricksWon: number
  hand?: StandardCard[]         // Only present for the requesting player
  handSize: number              // Number of cards in hand (for all players)
  isHuman?: boolean
  disconnected?: boolean        // True if player lost connection
}
