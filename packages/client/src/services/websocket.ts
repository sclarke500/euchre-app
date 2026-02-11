import type {
  ClientMessage,
  ServerMessage,
} from '@euchre/shared'

type MessageHandler = (message: ServerMessage) => void
type ReconnectHandler = () => void

class WebSocketService {
  private ws: WebSocket | null = null
  private handlers: Set<MessageHandler> = new Set()
  private reconnectHandlers: Set<ReconnectHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private url: string = ''
  private wasConnected = false
  private clientSeq = 0

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  get connectionState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (!this.ws) return 'disconnected'
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting'
      case WebSocket.OPEN:
        return 'connected'
      default:
        return 'disconnected'
    }
  }

  connect(url: string): Promise<void> {
    this.url = url

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          const wasReconnect = this.wasConnected
          this.reconnectAttempts = 0
          this.wasConnected = true
          resolve()
          
          // If this was a reconnect, notify handlers
          if (wasReconnect) {
            console.log('WebSocket reconnected - notifying handlers')
            this.reconnectHandlers.forEach(handler => handler())
          }
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as ServerMessage
            this.handlers.forEach((handler) => handler(message))
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.reconnectAttempts = this.maxReconnectAttempts // Prevent auto-reconnect
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = message.clientSeq === undefined
        ? {
            ...message,
            clientSeq: this.clientSeq++,
            commandId: message.commandId ?? generateCommandId(),
          }
        : message
      this.ws.send(JSON.stringify(payload))
    } else {
      console.error('WebSocket not connected, cannot send message:', message.type)
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
  onReconnect(handler: ReconnectHandler): () => void {
    this.reconnectHandlers.add(handler)
    return () => this.reconnectHandlers.delete(handler)
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      if (this.url) {
        this.connect(this.url).catch((error) => {
          console.error('Reconnect failed:', error)
        })
      }
    }, delay)
  }
}

function generateCommandId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Singleton instance
export const websocket = new WebSocketService()
