import { WebSocket } from 'ws'
import type { ServerMessage } from '@67cards/shared'
import type { ConnectedClient } from '../ws/types.js'

export interface MessagingHelpers {
  send: (ws: WebSocket, message: ServerMessage) => void
  sendToPlayer: (odusId: string, message: ServerMessage) => void
  broadcast: (message: ServerMessage, excludeWs?: WebSocket) => void
  broadcastToTable: (tableId: string, message: ServerMessage, excludeWs?: WebSocket) => void
  broadcastToGame: (gameId: string, message: ServerMessage) => void
}

export function createMessagingHelpers(
  clients: Map<WebSocket, ConnectedClient>
): MessagingHelpers {
  function send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  function sendToPlayer(odusId: string, message: ServerMessage): void {
    // Send to all OPEN sockets for this player.
    // During reconnect, multiple client entries might exist for the same odusId.
    // Sending to all ensures the message reaches the active socket(s).
    let sentCount = 0
    for (const [ws, client] of clients) {
      if (client.player?.odusId === odusId && ws.readyState === WebSocket.OPEN) {
        send(ws, message)
        sentCount++
      }
    }
    // Debug: log if no sockets were found (possible disconnected edge case)
    if (sentCount === 0) {
      console.warn(`[Messaging] sendToPlayer: no open sockets found for odusId=${odusId}`)
    }
  }

  function broadcast(message: ServerMessage, excludeWs?: WebSocket): void {
    for (const [ws] of clients) {
      if (ws !== excludeWs) {
        send(ws, message)
      }
    }
  }

  function broadcastToTable(tableId: string, message: ServerMessage, excludeWs?: WebSocket): void {
    for (const [ws, client] of clients) {
      if (client.tableId === tableId && ws !== excludeWs) {
        send(ws, message)
      }
    }
  }

  function broadcastToGame(gameId: string, message: ServerMessage): void {
    for (const [ws, client] of clients) {
      if (client.gameId === gameId) {
        send(ws, message)
      }
    }
  }

  return {
    send,
    sendToPlayer,
    broadcast,
    broadcastToTable,
    broadcastToGame,
  }
}
