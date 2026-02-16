import type {
  SpadesBid,
  SpadesClientGameState,
  SpadesTeamScore,
  StandardCard,
} from '@67cards/shared'

export interface SpadesGamePlayer {
  odusId: string | null
  seatIndex: number
  name: string
  isHuman: boolean
  hand: StandardCard[]
  teamId: number
  bid: SpadesBid | null
  tricksWon: number
}

export interface SpadesGameEvents {
  onStateChange: (playerId: string | null, state: SpadesClientGameState) => void
  onBidMade: (playerId: number, bid: SpadesBid, playerName: string) => void
  onCardPlayed: (playerId: number, card: StandardCard, playerName: string) => void
  onTrickComplete: (winnerId: number, winnerName: string, cards: Array<{ playerId: number; card: StandardCard }>) => void
  onRoundComplete: (scores: SpadesTeamScore[], teamTricks: [number, number]) => void
  onGameOver: (winningTeam: number, finalScores: SpadesTeamScore[]) => void
  onYourTurn: (playerId: string, validActions: string[], validCards?: string[]) => void
  onTurnReminder: (playerId: string, validActions: string[], validCards?: string[]) => void
  onPlayerTimedOut: (playerId: number, playerName: string) => void
  onPlayerBooted: (playerId: number, playerName: string) => void
}
