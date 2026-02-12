import type { GameType, TableSettings } from '@euchre/shared'
import type { Game } from '../Game.js'
import type { PresidentGame } from '../PresidentGame.js'

export const games = new Map<string, Game>()
export const presidentGames = new Map<string, PresidentGame>()
export const gameHosts = new Map<string, string>()
export const gameTypes = new Map<string, GameType>()
export const gameSettings = new Map<string, TableSettings | undefined>()

export function getCurrentStateSeq(gameId: string): number | null {
  const gameType = gameTypes.get(gameId)
  if (gameType === 'president') {
    return presidentGames.get(gameId)?.getStateSeq() ?? null
  }
  return games.get(gameId)?.getStateSeq() ?? null
}