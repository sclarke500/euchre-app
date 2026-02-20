import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@67cards/shared'
import { CHAT_RATE_LIMIT_MS } from '@67cards/shared'
import { websocket } from '@/services/websocket'

export const useChatStore = defineStore('chat', () => {
  // All chat messages for current game
  const messages = ref<ChatMessage[]>([])
  
  // Track when we last sent a message (for client-side rate limiting UI)
  const lastSentAt = ref<number>(0)
  
  // Last read timestamp (for unread indicator)
  const lastReadAt = ref<number>(Date.now())
  
  // Currently showing bubble per seat: seatIndex -> ChatMessage
  const activeBubbles = ref<Map<number, ChatMessage>>(new Map())
  
  // Bubble timers for auto-dismiss
  const bubbleTimers = ref<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  
  // Debug mode: test bubbles stay visible (no auto-dismiss)
  const debugBubbles = ref(false)

  // Computed: unread message count
  const unreadCount = computed(() => {
    return messages.value.filter(m => m.timestamp > lastReadAt.value).length
  })

  // Check if we can send (must be a function, not computed - Date.now() isn't reactive)
  function canSend(): boolean {
    return Date.now() - lastSentAt.value >= CHAT_RATE_LIMIT_MS
  }

  function sendChatMessage(text: string, isQuickReact?: boolean): boolean {
    const trimmed = text.trim()
    if (!trimmed) return false
    
    // Client-side rate limit check (server will also enforce)
    if (!canSend()) {
      console.warn('[Chat] Rate limited - wait before sending')
      return false
    }

    websocket.send({
      type: 'chat_send',
      text: trimmed,
      isQuickReact,
    })
    
    lastSentAt.value = Date.now()
    return true
  }

  function receiveMessage(message: ChatMessage): void {
    messages.value.push(message)
    
    // Show bubble above sender's avatar
    showBubble(message)
  }

  function showBubble(message: ChatMessage): void {
    const { seatIndex } = message
    
    // Clear existing timer for this seat
    const existingTimer = bubbleTimers.value.get(seatIndex)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    
    // Set the active bubble
    activeBubbles.value.set(seatIndex, message)
    
    // Calculate duration: 3s base + 1s per 50 chars, max 8s
    const baseMs = 3000
    const perCharMs = 1000 / 50
    const duration = Math.min(8000, baseMs + message.text.length * perCharMs)
    
    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      hideBubble(seatIndex)
    }, duration)
    
    bubbleTimers.value.set(seatIndex, timer)
  }

  function hideBubble(seatIndex: number): void {
    activeBubbles.value.delete(seatIndex)
    const timer = bubbleTimers.value.get(seatIndex)
    if (timer) {
      clearTimeout(timer)
      bubbleTimers.value.delete(seatIndex)
    }
  }

  function markAsRead(): void {
    lastReadAt.value = Date.now()
  }

  function clearChat(): void {
    messages.value = []
    activeBubbles.value.clear()
    bubbleTimers.value.forEach(timer => clearTimeout(timer))
    bubbleTimers.value.clear()
    lastReadAt.value = Date.now()
    debugBubbles.value = false
  }

  /**
   * Toggle test bubbles for all seats (for positioning/styling)
   * In debug mode, bubbles don't auto-dismiss
   */
  function toggleTestBubbles(playerNames: string[] = ['You', 'Left AI', 'Partner', 'Right AI']): void {
    debugBubbles.value = !debugBubbles.value
    
    if (debugBubbles.value) {
      // Show a test bubble for each seat
      const testMessages: [number, string][] = [
        [0, 'Nice play! 🎉'],
        [1, 'Good luck everyone'],
        [2, 'Let\'s go team!'],
        [3, 'gg'],
      ]
      
      testMessages.forEach(([seatIndex, text]) => {
        const testMessage: ChatMessage = {
          id: `test-${seatIndex}`,
          odusId: `test-player-${seatIndex}`,
          seatIndex,
          playerName: playerNames[seatIndex] ?? `Player ${seatIndex}`,
          text,
          timestamp: Date.now(),
        }
        activeBubbles.value.set(seatIndex, testMessage)
      })
      
      console.log('[Chat] Test bubbles ON - Ctrl+Shift+B to toggle')
    } else {
      // Clear test bubbles
      activeBubbles.value.clear()
      console.log('[Chat] Test bubbles OFF')
    }
  }

  return {
    // State
    messages,
    activeBubbles,
    unreadCount,
    debugBubbles,
    
    // Actions
    sendChatMessage,
    canSend,
    receiveMessage,
    hideBubble,
    markAsRead,
    clearChat,
    toggleTestBubbles,
  }
})
