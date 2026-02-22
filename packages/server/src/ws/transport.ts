import { WebSocketServer, WebSocket } from 'ws'
import { createServer, type Server as HttpServer } from 'http'
import express, { type Express } from 'express'

export interface WebSocketTransportOptions {
  port: number
  onConnection: (ws: WebSocket) => void
  onMessage: (ws: WebSocket, data: Buffer) => void
  onClose: (ws: WebSocket, code: number, reason: Buffer) => void
  onError: (ws: WebSocket, error: Error) => void
  heartbeatIntervalMs?: number
}

export interface TransportServer {
  wss: WebSocketServer
  httpServer: HttpServer
  app: Express
}

export function createWebSocketServer(options: WebSocketTransportOptions): TransportServer {
  const {
    port,
    onConnection,
    onMessage,
    onClose,
    onError,
    heartbeatIntervalMs = 30_000,
  } = options

  const app = express()
  app.use(express.json())
  
  const httpServer = createServer(app)
  const wss = new WebSocketServer({ server: httpServer })
  
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`HTTP + WebSocket server listening on port ${port} (all interfaces)`)
  })

  wss.on('connection', (ws: WebSocket) => {
    ;(ws as { isAlive?: boolean }).isAlive = true
    ws.on('pong', () => {
      ;(ws as { isAlive?: boolean }).isAlive = true
    })

    onConnection(ws)

    ws.on('message', (data: Buffer) => {
      onMessage(ws, data)
    })

    ws.on('close', (code: number, reason: Buffer) => {
      onClose(ws, code, reason)
    })

    ws.on('error', (error: Error) => {
      onError(ws, error)
    })
  })

  const interval = setInterval(() => {
    for (const client of wss.clients) {
      const socket = client as WebSocket & { isAlive?: boolean }
      if (socket.isAlive === false) {
        client.terminate()
        continue
      }
      socket.isAlive = false
      client.ping()
    }
  }, heartbeatIntervalMs)

  wss.on('close', () => {
    clearInterval(interval)
  })

  return { wss, httpServer, app }
}