// Multiplayer Types for WebSocket Communication

import type { Suit, Card, GameState, Bid, GamePhase, TeamScore, Trick } from './game.js'

// ============================================
// Lobby & Table Types
// ============================================

export interface LobbyPlayer {
  odusId: string // Unique player ID (UUID)
  nickname: string
  connectedAt: number
}

export interface TableSeat {
  odusIndex: number // 0-3
  player: LobbyPlayer | null // null if empty
  isHost: boolean
}

export interface Table {
  odusId: string // Unique table ID
  name: string
  seats: TableSeat[]
  hostId: string // odusId of the player who created the table
  createdAt: number
}

export interface LobbyState {
  tables: Table[]
  connectedPlayers: number
}

// ============================================
// Client -> Server Messages
// ============================================

export type ClientMessage =
  | JoinLobbyMessage
  | CreateTableMessage
  | JoinTableMessage
  | LeaveTableMessage
  | StartGameMessage
  | MakeBidMessage
  | PlayCardMessage
  | DiscardCardMessage

export interface JoinLobbyMessage {
  type: 'join_lobby'
  nickname: string
  odusId?: string // Optional - for reconnection
}

export interface CreateTableMessage {
  type: 'create_table'
  tableName?: string
}

export interface JoinTableMessage {
  type: 'join_table'
  tableId: string
  seatIndex: number // 0-3
}

export interface LeaveTableMessage {
  type: 'leave_table'
}

export interface StartGameMessage {
  type: 'start_game'
}

export interface MakeBidMessage {
  type: 'make_bid'
  action: Bid['action']
  suit?: Suit
  goingAlone?: boolean
}

export interface PlayCardMessage {
  type: 'play_card'
  cardId: string
}

export interface DiscardCardMessage {
  type: 'discard_card'
  cardId: string
}

// ============================================
// Server -> Client Messages
// ============================================

export type ServerMessage =
  | WelcomeMessage
  | LobbyStateMessage
  | TableUpdatedMessage
  | TableRemovedMessage
  | JoinedTableMessage
  | LeftTableMessage
  | GameStartedMessage
  | GameStateMessage
  | YourTurnMessage
  | BidMadeMessage
  | CardPlayedMessage
  | TrickCompleteMessage
  | RoundCompleteMessage
  | GameOverMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | ErrorMessage

export interface WelcomeMessage {
  type: 'welcome'
  odusId: string // Assigned or confirmed player ID
  nickname: string
}

export interface LobbyStateMessage {
  type: 'lobby_state'
  state: LobbyState
}

export interface TableUpdatedMessage {
  type: 'table_updated'
  table: Table
}

export interface TableRemovedMessage {
  type: 'table_removed'
  tableId: string
}

export interface JoinedTableMessage {
  type: 'joined_table'
  table: Table
  seatIndex: number
}

export interface LeftTableMessage {
  type: 'left_table'
}

export interface GameStartedMessage {
  type: 'game_started'
  gameId: string
}

// Filtered game state - player only sees their own cards
export interface ClientGameState {
  phase: GamePhase
  players: ClientPlayer[]
  currentPlayer: number
  scores: TeamScore[]
  currentTrick: Trick | null
  completedTricks: number
  trump: Suit | null
  trumpCalledBy: number | null // Player ID who called trump
  goingAlone: boolean
  turnUpCard: Card | null
  biddingRound: 1 | 2 | null
  dealer: number
  gameOver: boolean
  winner: number | null
  tricksTaken: [number, number] // [team0, team1] tricks in current round
  tricksWonByPlayer: Record<number, number> // playerId -> tricks won this round
}

export interface ClientPlayer {
  id: number
  name: string
  handSize: number // Other players: only count
  hand?: Card[] // Only populated for the receiving player
  isHuman: boolean
  teamId: number
}

export interface GameStateMessage {
  type: 'game_state'
  state: ClientGameState
}

export interface YourTurnMessage {
  type: 'your_turn'
  validActions: string[] // List of valid action types
  validCards?: string[] // Card IDs that can be played
}

export interface BidMadeMessage {
  type: 'bid_made'
  playerId: number
  action: Bid['action']
  suit?: Suit
  goingAlone?: boolean
  playerName: string
}

export interface CardPlayedMessage {
  type: 'card_played'
  playerId: number
  card: Card
  playerName: string
}

export interface TrickCompleteMessage {
  type: 'trick_complete'
  winnerId: number
  winnerName: string
  cards: Array<{ playerId: number; card: Card }>
}

export interface RoundCompleteMessage {
  type: 'round_complete'
  scores: GameState['scores']
  tricksTaken: [number, number] // [team0, team1]
  pointsAwarded: [number, number]
}

export interface GameOverMessage {
  type: 'game_over'
  winningTeam: number
  finalScores: GameState['scores']
}

export interface PlayerJoinedMessage {
  type: 'player_joined'
  seatIndex: number
  player: LobbyPlayer
}

export interface PlayerLeftMessage {
  type: 'player_left'
  seatIndex: number
  playerId: string
  replacedWithAI: boolean
}

export interface ErrorMessage {
  type: 'error'
  message: string
  code?: string
}
