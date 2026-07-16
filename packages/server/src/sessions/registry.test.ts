import { describe, it, expect, beforeEach } from 'vitest'
import {
  runtimes,
  games,
  registerRuntime,
  unregisterRuntime,
  findRuntimeByPlayer,
  sweepFinishedGames,
  type RuntimeRegistryEntry,
} from './registry.js'
import type { GameRuntime } from './runtime.js'

/**
 * Tests for stale finished-game handling (issue #67).
 *
 * A player who closes the app from the victory screen never sends leave_game,
 * so the finished runtime keeps their odusId. On reconnect they must be matched
 * to their live game, never a finished one — and finished runtimes must
 * eventually be swept so they don't leak.
 */

function makeRuntime(options: {
  playerIds?: string[]
  gameOver?: boolean
  onCleanup?: () => void
}): GameRuntime {
  const playerIds = options.playerIds ?? []
  let gameOver = options.gameOver ?? false
  return {
    id: 'test',
    initializePlayers: () => {},
    start: () => {},
    resendStateToPlayer: () => {},
    findPlayerIndexByOdusId: (odusId) => playerIds.indexOf(odusId),
    replaceWithAI: () => true,
    restoreHumanPlayer: () => true,
    bootPlayer: () => true,
    getPlayerInfo: (odusId) => {
      const idx = playerIds.indexOf(odusId)
      return idx >= 0 ? { seatIndex: idx, name: `P${idx}` } : null
    },
    getStateSeq: () => 0,
    isGameOver: () => gameOver,
    cleanup: options.onCleanup,
  }
}

function register(gameId: string, runtime: GameRuntime): RuntimeRegistryEntry {
  const entry: RuntimeRegistryEntry = { type: 'euchre', runtime, hostId: 'host' }
  registerRuntime(gameId, entry)
  return entry
}

beforeEach(() => {
  for (const gameId of [...runtimes.keys()]) {
    unregisterRuntime(gameId)
  }
  games.clear()
})

describe('findRuntimeByPlayer', () => {
  it('matches a live game containing the player', () => {
    register('game-1', makeRuntime({ playerIds: ['alice'] }))
    expect(findRuntimeByPlayer('alice')?.gameId).toBe('game-1')
    expect(findRuntimeByPlayer('bob')).toBeNull()
  })

  it('skips finished games so reconnects reach the live game', () => {
    // Finished game registered first (older) — this was the #67 scenario
    register('old-game', makeRuntime({ playerIds: ['alice'], gameOver: true }))
    register('live-game', makeRuntime({ playerIds: ['alice'] }))

    expect(findRuntimeByPlayer('alice')?.gameId).toBe('live-game')
  })

  it('returns null when the only match is a finished game', () => {
    register('old-game', makeRuntime({ playerIds: ['alice'], gameOver: true }))
    expect(findRuntimeByPlayer('alice')).toBeNull()
  })

  it('prefers the newest live game when several match', () => {
    register('stale-live', makeRuntime({ playerIds: ['alice'] }))
    register('newest-live', makeRuntime({ playerIds: ['alice'] }))
    expect(findRuntimeByPlayer('alice')?.gameId).toBe('newest-live')
  })
})

describe('sweepFinishedGames', () => {
  const GRACE_MS = 15 * 60 * 1000

  it('leaves live games alone', () => {
    register('live', makeRuntime({}))
    sweepFinishedGames(0)
    sweepFinishedGames(GRACE_MS * 2)
    expect(runtimes.has('live')).toBe(true)
  })

  it('removes finished games only after the grace period', () => {
    let cleaned = false
    register('done', makeRuntime({ gameOver: true, onCleanup: () => { cleaned = true } }))

    sweepFinishedGames(0) // first sighting — starts the clock
    expect(runtimes.has('done')).toBe(true)

    sweepFinishedGames(GRACE_MS - 1)
    expect(runtimes.has('done')).toBe(true)

    const swept = sweepFinishedGames(GRACE_MS)
    expect(swept).toEqual(['done'])
    expect(runtimes.has('done')).toBe(false)
    expect(cleaned).toBe(true)
  })

  it('restarting (unregister) resets the finished-game clock for a reused id', () => {
    register('game', makeRuntime({ gameOver: true }))
    sweepFinishedGames(0)
    unregisterRuntime('game')

    register('game', makeRuntime({ gameOver: true }))
    // Old first-seen timestamp must not carry over
    expect(sweepFinishedGames(GRACE_MS)).toEqual([])
    expect(runtimes.has('game')).toBe(true)
  })
})
