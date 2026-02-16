import { type GameType, type TableSettings } from '@67cards/shared'
import type { Game } from '../Game.js'
import type { PresidentGame } from '../PresidentGame.js'
import type { SpadesGame } from '../SpadesGame.js'
import type { GameRuntime } from './runtime.js'

export interface RuntimeRegistryEntry {
  type: GameType
  runtime: GameRuntime
  hostId: string
  settings?: TableSettings
}

export const games = new Map<string, Game>()
export const presidentGames = new Map<string, PresidentGame>()
export const spadesGames = new Map<string, SpadesGame>()
export const gameHosts = new Map<string, string>()
export const gameTypes = new Map<string, GameType>()
export const gameSettings = new Map<string, TableSettings | undefined>()
export const runtimes = new Map<string, RuntimeRegistryEntry>()

export function registerRuntime(
  gameId: string,
  entry: RuntimeRegistryEntry
): void {
  runtimes.set(gameId, entry)
  gameTypes.set(gameId, entry.type)
  gameHosts.set(gameId, entry.hostId)
  gameSettings.set(gameId, entry.settings)
}

export function unregisterRuntime(gameId: string): void {
  runtimes.delete(gameId)
  gameTypes.delete(gameId)
  gameHosts.delete(gameId)
  gameSettings.delete(gameId)
}

export function getRuntime(gameId: string): RuntimeRegistryEntry | null {
  return runtimes.get(gameId) ?? null
}

export function findRuntimeByPlayer(odusId: string): { gameId: string; entry: RuntimeRegistryEntry } | null {
  for (const [gameId, entry] of runtimes) {
    if (entry.runtime.getPlayerInfo(odusId)) {
      return { gameId, entry }
    }
  }
  return null
}

export function getCurrentStateSeq(gameId: string): number | null {
  const runtimeEntry = runtimes.get(gameId)
  if (runtimeEntry) {
    return runtimeEntry.runtime.getStateSeq()
  }

  return null
}