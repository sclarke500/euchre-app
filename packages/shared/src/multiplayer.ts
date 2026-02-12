// Multiplayer Types for WebSocket Communication

import type { Suit, Card, GameState, Bid, GamePhase, TeamScore, Trick } from './game.js'
import type { StandardCard } from './core/types.js'
import type { PresidentPhase, PresidentPile, PlayerRank, PlayType } from './president/types.js'

// ============================================
// Lobby & Table Types
// ============================================

export interface LobbyPlayer {
  odusId: string // Unique player ID (UUID)
  nickname: string
  connectedAt: number
}

export interface TableSeat {
  odusIndex: number // 0-3 for Euchre, 0-7 for President
  player: LobbyPlayer | null // null if empty
  isHost: boolean
}

export type GameType = 'euchre' | 'president'

export interface TableSettings {
  superTwosMode?: boolean // President only
  maxRounds?: number // President only (default 5)
  aiDifficulty?: 'easy' | 'hard' // Euchre only
}

export interface Table {
  odusId: string // Unique table ID
  name: string
  seats: TableSeat[]
  hostId: string // odusId of the player who created the table
  createdAt: number
  gameType: GameType // NEW: Which game this table is for
  maxPlayers: number // NEW: 4 for Euchre, 4-8 for President
  settings?: TableSettings // NEW: Game-specific settings
}

export interface LobbyState {
  tables: Table[]
  connectedPlayers: number
}

// ============================================
// Client -> Server Messages
// ============================================

export interface ClientMessageMeta {
  clientSeq?: number // Client-side sequence number (monotonic)
  commandId?: string // Optional unique command ID for idempotency
  expectedStateSeq?: number // Client's last known state sequence
}

export type ClientMessage = (
  | JoinLobbyMessage
  | CreateTableMessage
  | JoinTableMessage
  | LeaveTableMessage
  | LeaveGameMessage
  | StartGameMessage
  | RestartGameMessage
  | MakeBidMessage
  | PlayCardMessage
  | DiscardCardMessage
  | RequestStateMessage
  | BootPlayerMessage
  // President-specific messages
  | PresidentPlayCardsMessage
  | PresidentPassMessage
  | PresidentGiveCardsMessage
  | BugReportMessage
) & ClientMessageMeta

export interface JoinLobbyMessage {
  type: 'join_lobby'
  nickname: string
  odusId?: string // Optional - for reconnection
}

export interface CreateTableMessage {
  type: 'create_table'
  tableName?: string
  gameType?: GameType // NEW: 'euchre' | 'president' (default 'euchre')
  maxPlayers?: number // NEW: For President (4-8), ignored for Euchre
  settings?: TableSettings // NEW: Game-specific settings
}

export interface JoinTableMessage {
  type: 'join_table'
  tableId: string
  seatIndex: number // 0-3 for Euchre, 0-7 for President
}

export interface LeaveTableMessage {
  type: 'leave_table'
}

export interface LeaveGameMessage {
  type: 'leave_game'
}

export interface StartGameMessage {
  type: 'start_game'
}

export interface RestartGameMessage {
  type: 'restart_game'
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

export interface RequestStateMessage {
  type: 'request_state'
}

export interface BootPlayerMessage {
  type: 'boot_player'
  playerId: number // Seat index of player to boot
}

// President-specific client messages
export interface PresidentPlayCardsMessage {
  type: 'president_play_cards'
  cardIds: string[] // Multiple cards of same rank
}

export interface PresidentPassMessage {
  type: 'president_pass'
}

export interface PresidentGiveCardsMessage {
  type: 'president_give_cards'
  cardIds: string[]
}

export interface BugReportMessage {
  type: 'bug_report'
  payload: string // JSON-stringified diagnostic data
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
  | GameRestartingMessage
  | GameStateMessage
  | YourTurnMessage
  | TurnReminderMessage
  | PlayerTimedOutMessage
  | PlayerBootedMessage
  | BidMadeMessage
  | CardPlayedMessage
  | TrickCompleteMessage
  | RoundCompleteMessage
  | GameOverMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | ErrorMessage
  // President-specific messages
  | PresidentGameStateMessage
  | PresidentPlayMadeMessage
  | PresidentPassedMessage
  | PresidentPileClearedMessage
  | PresidentPlayerFinishedMessage
  | PresidentRoundCompleteMessage
  | PresidentGameOverMessage
  | PresidentCardExchangeInfoMessage
  | PresidentAwaitingGiveCardsMessage
  | PresidentYourTurnMessage
  | BugReportAckMessage

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

export interface GameRestartingMessage {
  type: 'game_restarting'
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
  stateSeq: number // Incrementing sequence number for drift detection
  timedOutPlayer: number | null // Seat index of player who has timed out (waiting to be booted)
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

export interface TurnReminderMessage {
  type: 'turn_reminder'
  validActions: string[]
  validCards?: string[]
}

export interface PlayerTimedOutMessage {
  type: 'player_timed_out'
  playerId: number // Seat index of player who timed out
  playerName: string
}

export interface PlayerBootedMessage {
  type: 'player_booted'
  playerId: number // Seat index of booted player
  playerName: string
  replacedWithAI: boolean
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

export interface BugReportAckMessage {
  type: 'bug_report_ack'
  success: boolean
  issueUrl?: string
}

// ============================================
// President-Specific Types
// ============================================

// Client state for President - filtered per player
export interface PresidentClientGameState {
  gameType: 'president'
  phase: PresidentPhase
  players: PresidentClientPlayer[]
  currentPlayer: number
  currentPile: PresidentPile
  consecutivePasses: number
  finishedPlayers: number[] // Player IDs in order they finished
  roundNumber: number
  gameOver: boolean
  lastPlayerId: number | null
  superTwosMode: boolean
  stateSeq: number // For drift detection
  timedOutPlayer: number | null
}

export interface PresidentClientPlayer {
  id: number
  name: string
  handSize: number // Other players only see count
  hand?: StandardCard[] // Only populated for the receiving player
  isHuman: boolean
  rank: PlayerRank | null
  finishOrder: number | null
  cardsToGive: number
  cardsToReceive: number
}

export interface PresidentGameStateMessage {
  type: 'president_game_state'
  state: PresidentClientGameState
}

export interface PresidentPlayMadeMessage {
  type: 'president_play_made'
  playerId: number
  cards: StandardCard[]
  playType: PlayType
  playerName: string
}

export interface PresidentPassedMessage {
  type: 'president_passed'
  playerId: number
  playerName: string
}

export interface PresidentPileClearedMessage {
  type: 'president_pile_cleared'
  nextPlayerId: number
}

export interface PresidentPlayerFinishedMessage {
  type: 'president_player_finished'
  playerId: number
  playerName: string
  finishPosition: number
  rank: PlayerRank
}

export interface PresidentRoundCompleteMessage {
  type: 'president_round_complete'
  rankings: Array<{ playerId: number; rank: PlayerRank; name: string }>
  roundNumber: number
}

export interface PresidentGameOverMessage {
  type: 'president_game_over'
  finalRankings: Array<{ playerId: number; name: string; rank: PlayerRank }>
}

export interface PresidentCardExchangeInfoMessage {
  type: 'president_card_exchange_info'
  youGive: StandardCard[]
  youReceive: StandardCard[]
  otherPlayerName: string
  yourRole: string // 'President', 'Scum', etc.
}

export interface PresidentAwaitingGiveCardsMessage {
  type: 'president_awaiting_give_cards'
  cardsToGive: number
  receivedCards: StandardCard[]
  yourRole: string // 'President' or 'Vice President'
}

export interface PresidentYourTurnMessage {
  type: 'president_your_turn'
  validActions: string[] // 'play', 'pass'
  validPlays: string[][] // Array of valid card ID combinations
}
