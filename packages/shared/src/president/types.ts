// President game types

import type { Suit, FullRank, StandardCard, BasePlayer, PlayedCard } from '../core/types.js'

// Game phases for President
export enum PresidentPhase {
  Setup = 'setup',
  Dealing = 'dealing',
  CardExchange = 'card_exchange',  // President/Scum card swap at round start
  Playing = 'playing',
  RoundComplete = 'round_complete',
  GameOver = 'game_over',
}

// Player rankings (positions)
export enum PlayerRank {
  President = 1,
  VicePresident = 2,
  Citizen = 3,
  Scum = 4,
}

// Play types (how many cards of same rank)
export type PlayType = 'single' | 'pair' | 'triple' | 'quad'

// A play in President (1-4 cards of same rank)
export interface PresidentPlay {
  cards: StandardCard[]
  playerId: number
  playType: PlayType
  rank: FullRank
}

// The center pile
export interface PresidentPile {
  plays: PresidentPlay[]
  currentPlayType: PlayType | null
  currentRank: FullRank | null
}

// President-specific player
export interface PresidentPlayer extends BasePlayer {
  hand: StandardCard[]
  rank: PlayerRank | null       // null = first round, no ranks yet
  finishOrder: number | null    // 1 = first out, null = still playing
  cardsToGive: number           // Cards owed to higher rank (0, 1, or 2)
  cardsToReceive: number        // Cards to receive from lower rank
}

// Full game state for President
export interface PresidentGameState {
  gameType: 'president'
  players: PresidentPlayer[]
  phase: PresidentPhase
  currentPile: PresidentPile
  currentPlayer: number
  consecutivePasses: number     // Passes since last play
  finishedPlayers: number[]     // Player IDs in finish order
  roundNumber: number
  gameOver: boolean
  lastPlayerId: number | null   // Who made the last non-pass play
}

// Actions a player can take
export enum PresidentAction {
  Play = 'play',
  Pass = 'pass',
  GiveCards = 'give_cards',     // During card exchange
}

// A player's action
export interface PresidentPlayerAction {
  playerId: number
  action: PresidentAction
  cards?: StandardCard[]        // Cards being played or given
}

// Card exchange during CardExchange phase
export interface CardExchange {
  fromPlayerId: number
  toPlayerId: number
  cards: StandardCard[]
}
