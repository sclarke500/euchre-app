// Multiplayer Types for WebSocket Communication

import type { Suit, Card, GameState, Bid, GamePhase, TeamScore, Trick } from '../euchre/types.js'

// ============================================
// Chat Types
// ============================================

export interface ChatMessage {
  id: string              // unique: `${odusId}-${timestamp}`
  odusId: string          // sender's odusId
  seatIndex: number       // sender's seat (for bubble positioning)
  playerName: string      // display name
  text: string            // message content (max 120 chars)
  timestamp: number       // Date.now()
  isQuickReact?: boolean  // true if from quick reaction picker
}

export const CHAT_MAX_LENGTH = 120
export const CHAT_RATE_LIMIT_MS = 1000  // 1 message per second
export const CHAT_HISTORY_LIMIT = 50    // max messages to keep
import type { StandardCard } from '../core/types.js'
import type { PresidentPhase, PresidentPile, PlayerRank, PlayType } from '../president/types.js'
import type {
  SpadesPhase,
  SpadesBidType,
  SpadesBid,
  SpadesTeamScore,
  SpadesTrick,
  SpadesClientPlayer,
} from '../spades/types.js'

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

export type GameType = 'euchre' | 'president' | 'spades'

export interface TableSettings {
  superTwosMode?: boolean // President only
  maxRounds?: number // President only (default 5)
  aiDifficulty?: 'easy' | 'hard' // All games
  chatEnabled?: boolean // Enable in-game chat (default true)
  isPrivate?: boolean // Private game - won't show in public lobby (default false)
  bootInactive?: boolean // Show turn timer and allow booting inactive players (default true)
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
  | PresidentConfirmExchangeMessage
  | SpadesMakeBidMessage
  | BugReportMessage
  // Chat
  | ChatSendMessage
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

export interface PresidentConfirmExchangeMessage {
  type: 'president_confirm_exchange'
  cardIds: string[]  // For President/VP: selected cards. For Scum/ViceScum: empty or pre-selected
}

export interface SpadesMakeBidMessage {
  type: 'spades_make_bid'
  bidType: SpadesBidType
  count: number
}

export interface BugReportMessage {
  type: 'bug_report'
  payload: string // JSON-stringified diagnostic data
}

export interface ChatSendMessage {
  type: 'chat_send'
  text: string
  isQuickReact?: boolean
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
  | PresidentExchangePromptMessage
  | PresidentExchangeCompleteMessage
  | PresidentYourTurnMessage
  | SpadesGameStateMessage
  | SpadesYourTurnMessage
  | BugReportAckMessage
  // Chat
  | ChatBroadcastMessage

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

export interface ChatBroadcastMessage {
  type: 'chat_broadcast'
  message: ChatMessage
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

export interface PresidentExchangePromptMessage {
  type: 'president_exchange_prompt'
  canSelect: boolean           // true = President/VP needs to pick cards, false = Scum/ViceScum pre-selected
  cardsNeeded: number          // How many cards to select (0 for Scum/ViceScum)
  preSelectedCardIds: string[] // For Scum/ViceScum: their best cards. For Pres/VP: empty
  recipientName: string        // Who they're exchanging with
}

export interface PresidentExchangeCompleteMessage {
  type: 'president_exchange_complete'
  youGave: StandardCard[]
  youReceived: StandardCard[]
}

export interface PresidentYourTurnMessage {
  type: 'president_your_turn'
  validActions: string[] // 'play', 'pass'
  validPlays: string[][] // Array of valid card ID combinations
}

// ============================================
// Spades-Specific Types
// ============================================

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
  stateSeq: number
  timedOutPlayer: number | null
}

export interface SpadesGameStateMessage {
  type: 'spades_game_state'
  state: SpadesClientGameState
}

export interface SpadesYourTurnMessage {
  type: 'spades_your_turn'
  validActions: string[]
  validCards?: string[]
}
