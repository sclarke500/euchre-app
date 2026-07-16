import { type GameType, type TableSettings } from '@67cards/shared'
import type { EuchreGame } from '../games/euchre/EuchreGame.js'
import type { PresidentGame } from '../games/president/PresidentGame.js'
import type { SpadesGame } from '../games/spades/SpadesGame.js'
import type { GameRuntime } from './runtime.js'

export interface RuntimeRegistryEntry {
  type: GameType
  runtime: GameRuntime
  hostId: string
  settings?: TableSettings
}

export const games = new Map<string, EuchreGame>()
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
  finishedGameFirstSeen.delete(gameId)
}

export function getRuntime(gameId: string): RuntimeRegistryEntry | null {
  return runtimes.get(gameId) ?? null
}

export function findRuntimeByPlayer(odusId: string): { gameId: string; entry: RuntimeRegistryEntry } | null {
  // Finished games can linger in the registry (players who close the app from the
  // victory screen never send leave_game). Matching one would send a reconnecting
  // player a stale game-over state instead of their live game, so skip them — and
  // keep scanning so the newest live match wins (Map iteration is insertion order).
  let match: { gameId: string; entry: RuntimeRegistryEntry } | null = null
  for (const [gameId, entry] of runtimes) {
    if (entry.runtime.isGameOver?.()) continue
    if (entry.runtime.getPlayerInfo(odusId)) {
      match = { gameId, entry }
    }
  }
  return match
}

// Finished games are swept from the registry after a grace period. The grace
// period keeps "Play Again" (restart_game) working for players idling on the
// victory screen; after that, the runtime is just leaked memory.
const FINISHED_GAME_GRACE_MS = 15 * 60 * 1000
const SWEEP_INTERVAL_MS = 60 * 1000
const finishedGameFirstSeen = new Map<string, number>()

export function sweepFinishedGames(now: number = Date.now()): string[] {
  const swept: string[] = []
  for (const [gameId, entry] of runtimes) {
    if (!entry.runtime.isGameOver?.()) {
      finishedGameFirstSeen.delete(gameId)
      continue
    }
    const firstSeen = finishedGameFirstSeen.get(gameId)
    if (firstSeen === undefined) {
      finishedGameFirstSeen.set(gameId, now)
    } else if (now - firstSeen >= FINISHED_GAME_GRACE_MS) {
      entry.runtime.cleanup?.()
      games.delete(gameId)
      presidentGames.delete(gameId)
      spadesGames.delete(gameId)
      unregisterRuntime(gameId)
      swept.push(gameId)
      console.log(`[Registry] Swept finished ${entry.type} game ${gameId}`)
    }
  }
  return swept
}

export function startFinishedGameSweeper(): ReturnType<typeof setInterval> {
  const timer = setInterval(() => sweepFinishedGames(), SWEEP_INTERVAL_MS)
  timer.unref?.()
  return timer
}

export function getCurrentStateSeq(gameId: string): number | null {
  const runtimeEntry = runtimes.get(gameId)
  if (runtimeEntry) {
    return runtimeEntry.runtime.getStateSeq()
  }

  return null
}