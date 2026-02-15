import type { GameType } from '@euchre/shared'

export interface RuntimePlayerInfo {
  seatIndex: number
  name: string
}

export interface HumanPlayerSeat {
  odusId: string
  name: string
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
}

export interface RuntimeWithType {
  type: GameType
  runtime: GameRuntime
}
