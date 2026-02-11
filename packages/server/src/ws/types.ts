import type { WebSocket } from 'ws'
import type { LobbyPlayer } from '@euchre/shared'

export interface ConnectedClient {
  ws: WebSocket
  player: LobbyPlayer | null
  tableId: string | null
  gameId: string | null
  lastClientSeq?: number
  recentCommandIds?: string[]
}