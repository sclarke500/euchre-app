import type { Bid, Card, ClientGameState, TeamScore } from '@67cards/shared'

export interface GamePlayer {
  odusId: string | null
  seatIndex: number
  name: string
  avatar?: string
  isHuman: boolean
  hand: Card[]
  teamId: number
}

export interface GameEvents {
  onStateChange: (playerId: string | null, state: ClientGameState) => void
  onBidMade: (playerId: number, bid: Bid, playerName: string) => void
  onCardPlayed: (playerId: number, card: Card, playerName: string) => void
  onTrickComplete: (winnerId: number, winnerName: string, cards: Array<{ playerId: number; card: Card }>) => void
  onRoundComplete: (scores: TeamScore[], tricksTaken: [number, number], pointsAwarded: [number, number]) => void
  onGameOver: (winningTeam: number, finalScores: TeamScore[]) => void
  onYourTurn: (playerId: string, validActions: string[], validCards?: string[]) => void
  onTurnReminder: (playerId: string, validActions: string[], validCards?: string[]) => void
  onPlayerTimedOut: (playerId: number, playerName: string) => void
  onPlayerBooted: (playerId: number, playerName: string) => void
}

export interface GameOptions {
  aiDifficulty?: 'easy' | 'hard'
}
