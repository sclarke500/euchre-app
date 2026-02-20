import type { WebSocket } from 'ws'
import type { ChatMessage, ServerMessage } from '@67cards/shared'
import { CHAT_MAX_LENGTH, CHAT_RATE_LIMIT_MS, CHAT_HISTORY_LIMIT } from '@67cards/shared'
import type { ConnectedClient } from '../ws/types.js'
import { getRuntime } from '../sessions/registry.js'

// Track rate limits per player: odusId -> last message timestamp
const rateLimits = new Map<string, number>()

// Chat history per game: gameId -> ChatMessage[]
const chatHistories = new Map<string, ChatMessage[]>()

export interface ChatHandlerDeps {
  send: (ws: WebSocket, message: ServerMessage) => void
  broadcastToGame: (gameId: string, message: ServerMessage) => void
}

export function createChatHandlers(deps: ChatHandlerDeps) {
  const { send, broadcastToGame } = deps

  function handleChatSend(
    ws: WebSocket,
    client: ConnectedClient,
    text: string,
    isQuickReact?: boolean
  ): void {
    // Must be in a game
    if (!client.gameId || !client.player) {
      send(ws, { type: 'error', message: 'Not in a game', code: 'not_in_game' })
      return
    }

    const odusId = client.player.odusId
    const now = Date.now()

    // Rate limit check
    const lastMessage = rateLimits.get(odusId)
    if (lastMessage && now - lastMessage < CHAT_RATE_LIMIT_MS) {
      send(ws, { type: 'error', message: 'Slow down! Wait before sending another message.', code: 'rate_limited' })
      return
    }

    // Validate and sanitize text
    const sanitized = text.trim().slice(0, CHAT_MAX_LENGTH)
    if (!sanitized) {
      return // Ignore empty messages
    }

    // Get player's seat index from runtime
    const runtimeEntry = getRuntime(client.gameId)
    if (!runtimeEntry) {
      send(ws, { type: 'error', message: 'Game not found', code: 'game_not_found' })
      return
    }

    const playerInfo = runtimeEntry.runtime.getPlayerInfo(odusId)
    if (!playerInfo) {
      send(ws, { type: 'error', message: 'Player not in game', code: 'player_not_found' })
      return
    }
    const seatIndex = playerInfo.seatIndex

    // Create chat message
    const chatMessage: ChatMessage = {
      id: `${odusId}-${now}`,
      odusId,
      seatIndex,
      playerName: client.player.nickname,
      text: sanitized,
      timestamp: now,
      isQuickReact,
    }

    // Update rate limit
    rateLimits.set(odusId, now)

    // Store in history
    let history = chatHistories.get(client.gameId)
    if (!history) {
      history = []
      chatHistories.set(client.gameId, history)
    }
    history.push(chatMessage)
    
    // Trim history if too long
    if (history.length > CHAT_HISTORY_LIMIT) {
      history.shift()
    }

    // Broadcast to all players in the game
    broadcastToGame(client.gameId, {
      type: 'chat_broadcast',
      message: chatMessage,
    })

    console.log(`[Chat] ${client.player.nickname} (game ${client.gameId}): ${sanitized}`)
  }

  function getChatHistory(gameId: string): ChatMessage[] {
    return chatHistories.get(gameId) ?? []
  }

  function clearChatHistory(gameId: string): void {
    chatHistories.delete(gameId)
  }

  return {
    handleChatSend,
    getChatHistory,
    clearChatHistory,
  }
}
