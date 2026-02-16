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
  isHuman: boolean
  hand: StandardCard[]
  rank: PlayerRank | null
  finishOrder: number | null
  cardsToGive: number
  cardsToReceive: number
}

export interface PresidentGameEvents {
  onStateChange: (playerId: string | null, state: PresidentClientGameState) => void
  onPlayMade: (playerId: number, cards: StandardCard[], playType: PlayType, playerName: string) => void
  onPassed: (playerId: number, playerName: string) => void
  onPileCleared: (nextPlayerId: number) => void
  onPlayerFinished: (playerId: number, playerName: string, finishPosition: number, rank: PlayerRank) => void
  onRoundComplete: (rankings: Array<{ playerId: number; rank: PlayerRank; name: string }>, roundNumber: number) => void
  onGameOver: (finalRankings: Array<{ playerId: number; name: string; rank: PlayerRank }>) => void
  onCardExchangeInfo: (playerId: string, youGive: StandardCard[], youReceive: StandardCard[], otherPlayerName: string, yourRole: string) => void
  onAwaitingGiveCards: (playerId: string, cardsToGive: number, receivedCards: StandardCard[], yourRole: string) => void
  onYourTurn: (playerId: string, validActions: string[], validPlays: string[][]) => void
  onTurnReminder: (playerId: string, validActions: string[], validPlays: string[][]) => void
  onPlayerTimedOut: (playerId: number, playerName: string) => void
  onPlayerBooted: (playerId: number, playerName: string) => void
}
