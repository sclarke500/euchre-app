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
