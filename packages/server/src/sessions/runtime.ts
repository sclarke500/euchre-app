import type { GameType } from '@67cards/shared'

export interface RuntimePlayerInfo {
  seatIndex: number
  name: string
}

export interface HumanPlayerSeat {
  odusId: string
  name: string
  avatar?: string
  seatIndex: number
}

export interface GameRuntime {
  readonly id: string
  initializePlayers(humanPlayers: HumanPlayerSeat[]): void
  start(): void
  resendStateToPlayer(odusId: string): void
  findPlayerIndexByOdusId(odusId: string): number
  replaceWithAI(playerIndex: number): boolean
  restoreHumanPlayer(seatIndex: number, odusId: string, nickname: string): boolean
  bootPlayer(playerIndex: number): boolean
  getPlayerInfo(odusId: string): RuntimePlayerInfo | null
  getStateSeq(): number
  // New disconnection handling (optional for backwards compatibility during rollout)
  markPlayerDisconnected?(playerIndex: number): boolean
  markPlayerReconnected?(playerIndex: number): boolean
  bootDisconnectedPlayer?(playerIndex: number): boolean
  // Cleanup method to clear all timers/intervals before game deletion
  cleanup?(): void
}

export interface RuntimeWithType {
  type: GameType
  runtime: GameRuntime
}
