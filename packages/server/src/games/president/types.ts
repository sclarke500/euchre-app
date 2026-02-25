import type {
  PlayerRank,
  PlayType,
  PresidentClientGameState,
  StandardCard,
} from '@67cards/shared'

export interface PresidentGamePlayer {
  odusId: string | null
  seatIndex: number
  name: string
  avatar?: string
  isHuman: boolean
  hand: StandardCard[]
  rank: PlayerRank | null
  finishOrder: number | null
  cardsToGive: number
  cardsToReceive: number
  disconnected?: boolean
}

export interface ExchangePromptInfo {
  canSelect: boolean           // true = President/VP needs to pick cards, false = Scum/ViceScum pre-selected
  cardsNeeded: number          // How many cards to select (0 for Scum/ViceScum)
  preSelectedCardIds: string[] // For Scum/ViceScum: their best cards. For Pres/VP: empty
  recipientName: string        // Who they're exchanging with
}

export interface PresidentGameEvents {
  onStateChange: (playerId: string | null, state: PresidentClientGameState) => void
  onPlayMade: (playerId: number, cards: StandardCard[], playType: PlayType, playerName: string) => void
  onPassed: (playerId: number, playerName: string) => void
  onPileCleared: (nextPlayerId: number) => void
  onPlayerFinished: (playerId: number, playerName: string, finishPosition: number, rank: PlayerRank) => void
  onRoundComplete: (rankings: Array<{ playerId: number; rank: PlayerRank; name: string }>, roundNumber: number) => void
  onGameOver: (finalRankings: Array<{ playerId: number; name: string; rank: PlayerRank }>) => void
  onExchangePrompt: (playerId: string, info: ExchangePromptInfo) => void
  onExchangeComplete: (playerId: string, youGave: StandardCard[], youReceived: StandardCard[]) => void
  onYourTurn: (playerId: string, validActions: string[], validPlays: string[][]) => void
  onTurnReminder: (playerId: string, validActions: string[], validPlays: string[][]) => void
  onPlayerTimedOut: (playerId: number, playerName: string) => void
  onPlayerBooted: (playerId: number, playerName: string) => void
  onPlayerDisconnected?: (playerId: number, playerName: string) => void
  onPlayerReconnected?: (playerId: number, playerName: string) => void
  onBotChat?: (seatIndex: number, playerName: string, text: string) => void
}
