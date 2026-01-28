// Core types shared across all card games

// Card suits (standard for all games)
export enum Suit {
  Hearts = 'hearts',
  Diamonds = 'diamonds',
  Clubs = 'clubs',
  Spades = 'spades',
}

// Full rank for 52-card games (President uses all)
export enum FullRank {
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

// Euchre uses only 9-A (24 cards)
export enum EuchreRank {
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

// Generic card interface - works with any rank type
export interface Card<R extends string = string> {
  suit: Suit
  rank: R
  id: string
}

// Convenience types for specific games
export type StandardCard = Card<FullRank>
export type EuchreCard = Card<EuchreRank>

// Base player interface - games extend this
export interface BasePlayer {
  id: number
  name: string
  hand: Card[]
  isHuman: boolean
}

// Card played with player info
export interface PlayedCard<R extends string = string> {
  card: Card<R>
  playerId: number
}

// Game type discriminator
export type GameType = 'euchre' | 'president'

// Team score (shared structure)
export interface TeamScore {
  teamId: number
  score: number
}
