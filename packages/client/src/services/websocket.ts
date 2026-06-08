import type {
  ClientMessage,
  ServerMessage,
} from '@67cards/shared'

type MessageHandler = (message: ServerMessage) => void
type ReconnectHandler = () => void

type LoggedMessage<T> = {
  ts: number
  message: T
}

function pushRing<T>(arr: Array<LoggedMessage<T>>, item: LoggedMessage<T>, max: number) {
  arr.push(item)
  if (arr.length > max) arr.splice(0, arr.length - max)
}

class WebSocketService {
  private ws: WebSocket | null = null
  private handlers: Set<MessageHandler> = new Set()
  private reconnectHandlers: Set<ReconnectHandler> = new Set()
  private reconnectAttempts = 0
  private reconnectDelay = 1000           // base backoff (ms)
  private maxReconnectDelay = 30000       // cap backoff so we keep probing ~every 30s, never give up
  private staleAfterHiddenMs = 10000      // if backgrounded longer than this, treat an OPEN socket as suspect
  private url: string = ''
  private wasConnected = false
  private clientSeq = 0

  // Reconnect / lifecycle bookkeeping
  private connecting = false
  private userClosed = false              // set by disconnect(); suppresses auto-reconnect
  private pendingRetry: ReturnType<typeof setTimeout> | null = null
  private connectPromise: Promise<void> | null = null
  private hiddenAt: number | null = null
  private lifecycleBound = false

  // Debug history (for bug reports) - keep small to avoid huge payloads
  private readonly maxHistory = 30
  private readonly inboundHistory: Array<LoggedMessage<ServerMessage>> = []
  private readonly outboundHistory: Array<LoggedMessage<ClientMessage>> = []

  getRecentInbound(): Array<LoggedMessage<ServerMessage>> {
    return [...this.inboundHistory]
  }

  getRecentOutbound(): Array<LoggedMessage<ClientMessage>> {
    return [...this.outboundHistory]
  }

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
    this.userClosed = false
    this.bindLifecycle()

    // Don't open a second socket if one is already connecting or healthy.
    if (this.connecting && this.connectPromise) return this.connectPromise
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve()

    console.log('WebSocket connecting to:', url)
    this.connecting = true

    this.connectPromise = new Promise((resolve, reject) => {
      // Connection timeout (10 seconds)
      const timeout = setTimeout(() => {
        console.error('WebSocket connection timeout')
        this.connecting = false
        if (this.ws) {
          this.ws.close() // triggers onclose → attemptReconnect
        }
        reject(new Error('Connection timeout'))
      }, 10000)

      try {
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          clearTimeout(timeout)
          console.log('WebSocket connected')
          const wasReconnect = this.wasConnected
          this.connecting = false
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
            pushRing(this.inboundHistory, { ts: Date.now(), message }, this.maxHistory)
            this.handlers.forEach((handler) => handler(message))
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onclose = (event) => {
          clearTimeout(timeout)
          console.log('WebSocket closed:', event.code, event.reason)
          this.connecting = false
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          clearTimeout(timeout)
          console.error('WebSocket error:', error)
          this.connecting = false
          reject(error)
        }
      } catch (error) {
        clearTimeout(timeout)
        this.connecting = false
        reject(error)
      }
    })

    return this.connectPromise
  }

  disconnect(): void {
    this.userClosed = true // Prevent auto-reconnect
    if (this.pendingRetry) {
      clearTimeout(this.pendingRetry)
      this.pendingRetry = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
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

      pushRing(this.outboundHistory, { ts: Date.now(), message: payload }, this.maxHistory)
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
    // Never permanently give up: keep retrying with capped, jittered backoff.
    // The resume listeners (visibilitychange/online/pageshow) short-circuit this
    // to an immediate reconnect when the app is foregrounded.
    if (this.userClosed || this.connecting) return
    if (this.pendingRetry) return // a retry is already scheduled

    this.reconnectAttempts++
    const capped = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    )
    // ±50% jitter to avoid a thundering herd when many clients drop at once.
    const delay = Math.max(0, Math.round(capped + capped * 0.5 * (Math.random() * 2 - 1)))

    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

    this.pendingRetry = setTimeout(() => {
      this.pendingRetry = null
      if (this.url && !this.userClosed) {
        this.connect(this.url).catch((error) => {
          console.error('Reconnect failed:', error)
        })
      }
    }, delay)
  }

  // Bind resume triggers once. On mobile (esp. iOS), JS is frozen while the app
  // is backgrounded and timers don't run — so the only reliable moment to recover
  // after a sleep is when the app is foregrounded again.
  private bindLifecycle(): void {
    if (this.lifecycleBound || typeof window === 'undefined') return
    this.lifecycleBound = true

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.hiddenAt = Date.now()
      } else if (document.visibilityState === 'visible') {
        this.handleResume()
      }
    })
    window.addEventListener('online', () => this.handleResume())
    window.addEventListener('pageshow', () => this.handleResume())
  }

  // Called when the app is foregrounded / network returns. Reconnects immediately
  // (resetting the backoff budget) instead of waiting on a possibly-frozen timer.
  private handleResume(): void {
    if (this.userClosed) return

    const hiddenMs = this.hiddenAt ? Date.now() - this.hiddenAt : 0
    this.hiddenAt = null

    const open = this.ws?.readyState === WebSocket.OPEN
    if (!open) {
      if (!this.connecting) {
        console.log('Resume: socket not open — reconnecting now')
        this.reconnectNow()
      }
      return
    }

    // Socket *reports* OPEN, but after a long background it may be a half-dead
    // "zombie" (common on iOS). Force a clean reconnect to validate it.
    if (hiddenMs >= this.staleAfterHiddenMs) {
      console.log(`Resume: was hidden ${hiddenMs}ms — forcing fresh reconnect to validate socket`)
      this.reconnectNow()
    }
  }

  // Tear down any existing socket without triggering the backoff path, reset the
  // attempt budget, and open a fresh connection immediately.
  private reconnectNow(): void {
    if (this.userClosed || !this.url) return

    this.reconnectAttempts = 0
    if (this.pendingRetry) {
      clearTimeout(this.pendingRetry)
      this.pendingRetry = null
    }

    if (this.ws) {
      // Detach handlers so the old socket's onclose doesn't race a new connect.
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      try {
        this.ws.close()
      } catch {
        // already closing/closed
      }
      this.ws = null
    }
    this.connecting = false

    this.connect(this.url).catch((error) => {
      console.error('Resume reconnect failed:', error)
    })
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
