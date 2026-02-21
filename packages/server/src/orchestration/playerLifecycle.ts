import { WebSocket } from 'ws'
import type { ConnectedClient } from '../ws/types.js'
import type { DisconnectedPlayer } from '../lobby/handlers.js'
import { findRuntimeByPlayer, getRuntime } from '../sessions/registry.js'

export function logOrchestrationEvent(event: string, details: Record<string, unknown>): void {
  console.info('[MP][orchestration]', {
    ts: Date.now(),
    event,
    ...details,
  })
}

export function tryRecoverGameId(client: ConnectedClient): boolean {
  if (!client.player || client.gameId) return false

  const odusId = client.player.odusId
  const runtimeEntry = findRuntimeByPlayer(odusId)

  if (runtimeEntry) {
    client.gameId = runtimeEntry.gameId
    console.log(
      `[Recovery] Restored gameId for ${client.player.nickname} -> ${runtimeEntry.entry.type} game ${runtimeEntry.gameId}`
    )
    return true
  }

  return false
}

export function replacePlayerWithAI(
  client: ConnectedClient,
  disconnectedPlayers: Map<string, DisconnectedPlayer>,
  trackForReconnect: boolean = false
): void {
  if (!client.player || !client.gameId) return

  const odusId = client.player.odusId
  const gameId = client.gameId
  const runtimeEntry = getRuntime(gameId)
  const gameType = runtimeEntry?.type || 'euchre'

  logOrchestrationEvent('replace_player_with_ai_start', {
    gameId,
    gameType,
    trackForReconnect,
    playerId: client.player.odusId,
    playerName: client.player.nickname,
  })

  if (runtimeEntry) {
    const idx = runtimeEntry.runtime.findPlayerIndexByOdusId(odusId)
    if (idx >= 0) {
      if (trackForReconnect) {
        disconnectedPlayers.set(odusId, {
          gameId,
          seatIndex: idx,
          gameType,
          disconnectTime: Date.now(),
        })
        console.log(`Tracking ${client.player.nickname} for reconnection (${gameType}, seat ${idx})`)
      }

      runtimeEntry.runtime.replaceWithAI(idx)
    }

    client.gameId = null
  } else {
    logOrchestrationEvent('replace_player_with_ai_missing_runtime', {
      gameId,
      playerId: client.player.odusId,
    })
    return
  }

  logOrchestrationEvent('replace_player_with_ai_done', {
    gameId,
    gameType,
    trackForReconnect,
    playerId: client.player.odusId,
  })
}

/**
 * Mark a player as disconnected (connection lost).
 * Does NOT replace with AI — just flags them as disconnected.
 * Other players can boot them to trigger AI replacement.
 */
export function markPlayerDisconnected(client: ConnectedClient): boolean {
  if (!client.player || !client.gameId) return false

  const odusId = client.player.odusId
  const gameId = client.gameId
  const runtimeEntry = getRuntime(gameId)

  if (!runtimeEntry) {
    logOrchestrationEvent('mark_disconnected_missing_runtime', {
      gameId,
      playerId: odusId,
    })
    return false
  }

  const idx = runtimeEntry.runtime.findPlayerIndexByOdusId(odusId)
  if (idx < 0) {
    logOrchestrationEvent('mark_disconnected_player_not_found', {
      gameId,
      playerId: odusId,
    })
    return false
  }

  // Call the game's markPlayerDisconnected method
  const success = runtimeEntry.runtime.markPlayerDisconnected?.(idx) ?? false
  
  logOrchestrationEvent('mark_player_disconnected', {
    gameId,
    gameType: runtimeEntry.type,
    playerId: odusId,
    playerName: client.player.nickname,
    seatIndex: idx,
    success,
  })

  return success
}

/**
 * Mark a player as reconnected (connection restored).
 */
export function markPlayerReconnected(client: ConnectedClient): boolean {
  if (!client.player || !client.gameId) return false

  const odusId = client.player.odusId
  const gameId = client.gameId
  const runtimeEntry = getRuntime(gameId)

  if (!runtimeEntry) return false

  const idx = runtimeEntry.runtime.findPlayerIndexByOdusId(odusId)
  if (idx < 0) return false

  const success = runtimeEntry.runtime.markPlayerReconnected?.(idx) ?? false
  
  logOrchestrationEvent('mark_player_reconnected', {
    gameId,
    gameType: runtimeEntry.type,
    playerId: odusId,
    playerName: client.player.nickname,
    seatIndex: idx,
    success,
  })

  return success
}

export function hasAlreadyReconnected(
  clients: Map<WebSocket, ConnectedClient>,
  ws: WebSocket,
  client: ConnectedClient
): boolean {
  if (!client.player || !client.gameId) {
    return false
  }

  for (const [otherWs, otherClient] of clients) {
    if (
      otherWs !== ws &&
      otherClient.player?.odusId === client.player.odusId &&
      otherClient.gameId === client.gameId
    ) {
      return true
    }
  }

  return false
}
