// Core Euchre Game Types

// Card suits
export enum Suit {
  Hearts = 'hearts',
  Diamonds = 'diamonds',
  Clubs = 'clubs',
  Spades = 'spades',
}

// Card ranks (9-A for Euchre)
export enum Rank {
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

// Card interface
export interface Card {
  suit: Suit
  rank: Rank
  id: string // Unique identifier for each card
}

// Trump selection
export interface Trump {
  suit: Suit
  calledBy: number // Player index who called trump
  goingAlone: boolean // True if player is going alone
}

// Player interface
export interface Player {
  id: number // 0-3, where 0 is human player
  name: string
  hand: Card[]
  isHuman: boolean
  teamId: number // 0 or 1 (teams are 0-2 and 1-3)
}

// Trick represents one round of 4 cards played
export interface Trick {
  cards: PlayedCard[]
  leadingSuit: Suit | null // The suit of the first card played
  winnerId: number | null // Player ID who won the trick
}

// Card played in a trick with player info
export interface PlayedCard {
  card: Card
  playerId: number
}

// Round represents one complete hand (5 tricks)
export interface Round {
  dealer: number // Player index who dealt
  trump: Trump | null
  tricks: Trick[]
  currentTrick: Trick
  kitty: Card[] // The 4 cards not dealt
  turnUpCard: Card | null // Card turned up for trump selection
  biddingRound: 1 | 2 // First round = turn up card, second round = call any suit
  currentPlayer: number // Index of player whose turn it is
  goingAlone: boolean
  alonePlayer: number | null // Player index if someone is going alone
}

// Game state
export interface GameState {
  players: Player[]
  currentRound: Round | null
  scores: TeamScore[]
  gameOver: boolean
  winner: number | null // Team ID that won
  phase: GamePhase
}

// Team score tracking
export interface TeamScore {
  teamId: number
  score: number
}

// Game phases
export enum GamePhase {
  Setup = 'setup',
  Dealing = 'dealing',
  BiddingRound1 = 'bidding_round_1', // Turn up card bidding
  BiddingRound2 = 'bidding_round_2', // Call any suit bidding
  Playing = 'playing',
  TrickComplete = 'trick_complete',
  RoundComplete = 'round_complete',
  GameOver = 'game_over',
}

// Bidding actions
export enum BidAction {
  OrderUp = 'order_up', // Tell dealer to pick up turn card
  PickUp = 'pick_up', // Dealer picks up turn card
  Pass = 'pass',
  CallTrump = 'call_trump', // Call a suit in round 2
  GoAlone = 'go_alone', // Declare going alone
}

// Bid interface
export interface Bid {
  playerId: number
  action: BidAction
  suit?: Suit // Only for CallTrump action
  goingAlone?: boolean
}
