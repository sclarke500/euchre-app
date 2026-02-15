# Multiplayer Game Architecture

A guide to implementing multiplayer card games based on our experience with Euchre, Spades, and President.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT SIDE                                     │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  GameBoard  │───▶│  Director   │───▶│   Adapter   │───▶│    Store    │  │
│  │   (.vue)    │    │ (animations)│    │ (interface) │    │ (WebSocket) │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                  │                                     │          │
│         ▼                  ▼                                     ▼          │
│  ┌─────────────┐    ┌─────────────┐                       ┌─────────────┐  │
│  │  CardTable  │    │ CardEngine  │                       │  WebSocket  │  │
│  │ (universal) │    │(useCardTable│                       │  Service    │  │
│  └─────────────┘    └─────────────┘                       └─────────────┘  │
│                                                                  │          │
└──────────────────────────────────────────────────────────────────│──────────┘
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVER SIDE                                     │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Router    │───▶│  Handlers   │───▶│    Game     │───▶│   Events    │  │
│  │  (ws/router)│    │ (sessions/) │    │ (XxxGame.ts)│    │ (callbacks) │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Client Architecture

### 1. Multiplayer Store (`stores/xxxMultiplayerStore.ts`)

**Purpose**: Manages WebSocket communication and raw game state.

**Responsibilities**:
- Subscribe to WebSocket messages
- Store raw game state from server
- Track turn state (`isMyTurn`, `validActions`, `validCards/validPlays`)
- Handle state synchronization
- Provide actions to send commands to server

**Key Patterns**:

```typescript
export const useXxxMultiplayerStore = defineStore('xxxMultiplayer', () => {
  // Raw state from server
  const gameState = ref<XxxClientGameState | null>(null)
  
  // Turn-specific state (updated via your_turn messages)
  const isMyTurn = ref(false)
  const validActions = ref<string[]>([])
  const validPlays = ref<string[][]>([])  // or validCards for single-card games
  
  // For detecting stale state / reconnection
  const gameLost = ref(false)
  const lastStateSeq = ref(0)
  
  // Message queue for animation synchronization
  const messageQueue: ServerMessage[] = []
  let queueMode = false

  // ⚠️ CRITICAL: Use updateIfChanged to prevent flickering
  function applyMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'xxx_game_state':
        gameState.value = message.state
        lastStateSeq.value = message.state.stateSeq
        // Clear turn state if not our turn
        if (!isOurTurn(message.state)) {
          updateIfChanged(isMyTurn, false)
          updateIfChanged(validActions, [])
          updateIfChanged(validPlays, [])
        }
        break
        
      case 'xxx_your_turn':
        updateIfChanged(isMyTurn, true)
        updateIfChanged(validActions, message.validActions)
        updateIfChanged(validPlays, message.validPlays)
        break
    }
  }
  
  // Queue mode: buffer messages while animations play
  function startQueueMode() { queueMode = true }
  function stopQueueMode() { queueMode = false }
  function drainQueue() { /* process buffered messages */ }
  
  // Actions send commands to server
  function playCards(cardIds: string[]) {
    websocket.send({
      type: 'xxx_play_cards',
      cardIds,
      expectedStateSeq: lastStateSeq.value
    })
  }
})
```

### 2. Game Adapter (`composables/useXxxGameAdapter.ts`)

**Purpose**: Unified interface for single-player and multiplayer modes.

**Responsibilities**:
- Abstract away the difference between local game engine and multiplayer store
- Transform data shapes (e.g., card IDs → card objects)
- Provide consistent API to Director and GameBoard

**Key Patterns**:

```typescript
export function useXxxGameAdapter(mode: 'singleplayer' | 'multiplayer') {
  // Choose data source based on mode
  const store = mode === 'multiplayer' 
    ? useXxxMultiplayerStore() 
    : useXxxSinglePlayerStore()
  
  // ⚠️ CRITICAL: Cache computed transformations to prevent flickering
  let cachedValidPlaysKey = ''
  let cachedValidPlays: StandardCard[][] = []
  
  const validPlays = computed(() => {
    const newKey = store.validPlays.map(p => p.join(',')).join('|')
    if (newKey === cachedValidPlaysKey) {
      return cachedValidPlays  // Return cached to prevent re-render
    }
    cachedValidPlaysKey = newKey
    cachedValidPlays = store.validPlays.map(ids => /* transform */)
    return cachedValidPlays
  })
  
  return {
    // Unified interface
    phase: computed(() => store.phase),
    players: computed(() => store.players),
    isHumanTurn: computed(() => store.isMyTurn),
    validPlays,
    
    // Actions
    playCards: (cards) => store.playCards(cards.map(c => c.id)),
    
    // Multiplayer-specific
    initialize: mode === 'multiplayer' ? () => store.initialize() : undefined,
    cleanup: mode === 'multiplayer' ? () => store.cleanup() : undefined,
  }
}
```

### 3. Director (`composables/useXxxDirector.ts`)

**Purpose**: Orchestrates card animations and visual updates.

**Responsibilities**:
- Watch game state changes and trigger animations
- Manage card positions via the CardEngine
- Handle animation queuing (pause state updates during animations)
- Map player IDs to seat positions (user always at bottom)

**Key Patterns**:

```typescript
export function useXxxDirector(
  game: ReturnType<typeof useXxxGameAdapter>,
  engine: CardTableEngine,
  options: { boardRef: Ref<HTMLElement | null> }
) {
  const isAnimating = ref(false)
  
  // Seat mapping: rotate so human is always seat 0 (bottom)
  function playerIdToSeat(playerId: number): number {
    const myId = game.humanPlayer.value?.id ?? 0
    return (playerId - myId + playerCount) % playerCount
  }
  
  // Watch for state changes and animate
  watch(() => game.lastPlayedCards.value, async (cards) => {
    if (!cards?.length) return
    
    isAnimating.value = true
    game.store.startQueueMode()  // Buffer incoming messages
    
    await animateCardsToCenter(cards)
    await delay(500)
    
    game.store.stopQueueMode()
    game.store.drainQueue()  // Apply buffered messages
    isAnimating.value = false
  })
  
  return {
    playerNames: computed(() => /* rotated names */),
    currentTurnSeat: computed(() => playerIdToSeat(game.currentPlayer.value)),
    isAnimating,
  }
}
```

### 4. GameBoard (`components/XxxGameBoard.vue`)

**Purpose**: UI component that renders the game.

**Responsibilities**:
- Wire up CardTable, Director, and Adapter
- Render game-specific UI (scoreboard, action buttons, modals)
- Handle user interactions (card clicks, button clicks)
- Show GameHUD (back button, bug report)

**Key Patterns**:

```vue
<template>
  <CardTable
    :player-count="playerCount"
    :player-names="director.playerNames.value"
    :engine="engine"
    :current-turn-seat="director.currentTurnSeat.value"
    :dimmed-card-ids="dimmedCardIds"
    @card-click="handleCardClick"
  >
    <!-- Game-specific slots -->
    <GameHUD
      :game-type="gameType"
      :build-payload="buildBugReportPayload"
      @leave="handleLeave"
    />
    
    <div class="scoreboard">...</div>
    <div class="action-panel">...</div>
  </CardTable>
</template>

<script setup>
const engine = useCardTable()
const game = useXxxGameAdapter(props.mode)
const director = useXxxDirector(game, engine, { boardRef })

// ⚠️ Initialize multiplayer on mount
onMounted(() => {
  if (props.mode === 'multiplayer') {
    game.initialize?.()
  }
})

onUnmounted(() => {
  director.cleanup?.()
  game.cleanup?.()
})
</script>
```

## Server Architecture

### 1. Game Class (`XxxGame.ts`)

**Purpose**: Core game logic and state management.

**Key Structure**:

```typescript
export class XxxGame {
  private gameId: string
  private players: Player[]
  private stateSeq = 0  // Increment on every state change
  
  // Event callbacks (injected by handler)
  private events: {
    onStateChange: (playerId: string, state: ClientState) => void
    onYourTurn: (playerId: string, validActions: string[], validPlays: string[][]) => void
    onGameOver: (winnerId: number) => void
    // ... game-specific events
  }
  
  constructor(gameId: string, events: typeof this.events) {
    this.gameId = gameId
    this.events = events
  }
  
  // Initialize with human players (AI fills remaining slots)
  initializePlayers(humans: { odusId: string, name: string }[]) {
    // Create player array, mixing humans and AI
  }
  
  start() {
    this.startNewRound()
  }
  
  // Player actions
  playCards(playerId: string, cardIds: string[]): void {
    // Validate and execute
    this.broadcastState()
    this.notifyNextPlayer()
  }
  
  // State broadcasting
  private broadcastState() {
    this.stateSeq++
    for (const player of this.players) {
      if (player.isHuman && player.odusId) {
        const state = this.getStateForPlayer(player.odusId)
        this.events.onStateChange(player.odusId, state)
      }
    }
  }
  
  // Get filtered state (hide other players' cards)
  private getStateForPlayer(odusId: string): ClientState {
    return {
      phase: this.phase,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        // Only include hand for the requesting player
        hand: p.odusId === odusId ? p.hand : undefined,
        handSize: p.hand.length,
      })),
      stateSeq: this.stateSeq,
      // ... other state
    }
  }
}
```

### 2. Session Handlers (`sessions/handlers.ts`)

**Purpose**: Bridge between WebSocket router and game instances.

```typescript
// Game creation
if (gameType === 'xxx') {
  const game = new XxxGame(gameId, {
    onStateChange: (playerId, state) => {
      sendToPlayer(playerId, { type: 'xxx_game_state', state })
    },
    onYourTurn: (playerId, validActions, validPlays) => {
      sendToPlayer(playerId, { 
        type: 'xxx_your_turn', 
        validActions, 
        validPlays 
      })
    },
  })
  
  game.initializePlayers(humanPlayers)
  xxxGames.set(gameId, game)
  game.start()
}

// Action handlers
function handleXxxPlayCards(ws, client, cardIds) {
  const game = xxxGames.get(client.gameId)
  if (!game) {
    send(ws, { type: 'error', code: 'game_lost' })
    return
  }
  game.playCards(client.odusId, cardIds)
}
```

### 3. WebSocket Router (`ws/router.ts`)

**Purpose**: Route incoming messages to appropriate handlers.

```typescript
interface Handlers {
  xxxPlayCards: (ws, client, cardIds: string[]) => void
  xxxPass: (ws, client) => void
  // ...
}

function routeMessage(ws, client, message, handlers) {
  switch (message.type) {
    case 'xxx_play_cards':
      handlers.xxxPlayCards(ws, client, message.cardIds)
      break
    case 'xxx_pass':
      handlers.xxxPass(ws, client)
      break
  }
}
```

## Message Protocol

### Server → Client Messages

| Message Type | When Sent | Purpose |
|--------------|-----------|---------|
| `xxx_game_state` | After any state change | Full game state snapshot |
| `xxx_your_turn` | When it becomes player's turn | Valid actions/plays |
| `xxx_play_made` | After a play | Animation trigger (optional) |
| `error` | On invalid action | Error handling |
| `game_started` | Game begins | Initial notification |

### Client → Server Messages

| Message Type | Purpose |
|--------------|---------|
| `xxx_play_cards` | Play card(s) |
| `xxx_pass` | Pass turn |
| `xxx_bid` | Make a bid (if applicable) |
| `request_state` | Request state resync |

## Additional Patterns (from industry guides)

### 1. Optimistic Updates

**What**: Client predicts the result before server confirms, then corrects if wrong.

**Why**: Makes the game feel more responsive (no waiting for round-trip).

**When to use**: Low-stakes actions like card selection highlights.

**When NOT to use**: Critical game actions (playing cards, bidding) - always wait for server.

```typescript
// Optimistic: highlight card immediately
function onCardClick(cardId) {
  setSelectedCard(cardId)  // Immediate local update
  socket.emit('select_card', cardId)  // Send to server
}

// Server confirms or rejects
socket.on('card_selected', (cardId) => {
  // Server confirmed - already showing correct state
})
socket.on('invalid_selection', () => {
  setSelectedCard(null)  // Rollback
})
```

### 2. Message Acknowledgments

**What**: Server confirms receipt of critical actions.

**Why**: Detect dropped messages, retry if needed.

```typescript
// Client
socket.emit('play_cards', cardIds, (ack) => {
  if (ack.success) {
    // Action confirmed
  } else {
    // Handle error, maybe retry
  }
})

// Server
socket.on('play_cards', (cardIds, callback) => {
  const result = game.playCards(cardIds)
  callback({ success: result.valid, error: result.error })
})
```

### 3. AI Takeover on Disconnect

**What**: When a player disconnects, AI takes over their seat.

**Why**: Game continues for remaining players.

```typescript
// Server
socket.on('disconnect', () => {
  const player = game.getPlayer(socket.odusId)
  if (player) {
    player.isAI = true
    player.isConnected = false
    broadcastToGame({ type: 'player_disconnected', playerId: player.id })
    
    // If it was their turn, AI plays
    if (game.currentPlayer === player.id) {
      setTimeout(() => game.aiTakeTurn(player.id), 2000)
    }
  }
})
```

### 4. Spectator Mode

**What**: Players can watch without participating.

**Why**: Useful for tournaments, learning, waiting to join.

```typescript
// Server
socket.on('join_as_spectator', (gameId) => {
  socket.join(`spectator:${gameId}`)
  // Send current state but no turn notifications
  socket.emit('game_state', game.getPublicState())
})

// Broadcast to spectators too
function broadcastState() {
  io.to(`game:${gameId}`).emit('game_state', state)
  io.to(`spectator:${gameId}`).emit('game_state', publicState)
}
```

### 5. Heartbeat / Keep-Alive

**What**: Periodic ping to detect dead connections.

**Why**: WebSocket connections can silently die (network changes, sleep mode).

```typescript
// Server - Socket.IO has built-in pingTimeout/pingInterval
const io = new Server(server, {
  pingTimeout: 60000,    // How long to wait for pong
  pingInterval: 25000,   // How often to ping
})

// Client can also send application-level heartbeat
setInterval(() => {
  socket.emit('heartbeat', { timestamp: Date.now() })
}, 30000)
```

### 6. Room Cleanup

**What**: Remove empty rooms to free memory.

**Why**: Long-running servers accumulate abandoned rooms.

```typescript
// Server
function checkRoomCleanup() {
  for (const [roomId, room] of rooms) {
    const hasPlayers = room.players.some(p => p.isConnected)
    const isStale = Date.now() - room.lastActivity > 30 * 60 * 1000 // 30 min
    
    if (!hasPlayers || isStale) {
      rooms.delete(roomId)
      console.log(`Cleaned up room ${roomId}`)
    }
  }
}
setInterval(checkRoomCleanup, 60000)
```

## Common Pitfalls & Solutions

### 1. Card Flickering

**Problem**: Cards flicker when valid plays update, even if content is the same.

**Cause**: Creating new arrays/Sets in computed properties triggers re-renders.

**Solution**: Use `updateIfChanged` in stores, cache transformations in adapters:

```typescript
// In store - use updateIfChanged
updateIfChanged(validPlays, message.validPlays)

// In adapter - cache transformations
let cachedKey = ''
let cachedResult = []
const transformed = computed(() => {
  const key = source.value.join(',')
  if (key === cachedKey) return cachedResult
  cachedKey = key
  cachedResult = source.value.map(/* transform */)
  return cachedResult
})
```

### 2. Animation Race Conditions

**Problem**: New state arrives while animation is playing, causing visual glitches.

**Solution**: Queue mode - buffer messages during animations:

```typescript
// Before animation
store.startQueueMode()

// ... play animation ...

// After animation
store.stopQueueMode()
store.drainQueue()  // Process buffered messages
```

### 3. Seat Rotation

**Problem**: Player order from server doesn't match visual layout.

**Solution**: Rotate seats so human is always at bottom (seat 0):

```typescript
function playerIdToSeat(playerId: number): number {
  const myId = game.humanPlayer.value?.id ?? 0
  const count = playerCount.value
  return (playerId - myId + count) % count
}
```

### 4. State Sequence Tracking

**Problem**: Out-of-order messages cause state corruption.

**Solution**: Track `stateSeq` and request resync if needed:

```typescript
// Server includes stateSeq in every state message
// Client tracks and can detect gaps
if (message.state.stateSeq < lastStateSeq.value) {
  // Stale message, ignore
  return
}
```

### 5. Game Lost / Reconnection

**Problem**: Player reconnects after server restart, game instance is gone.

**Solution**: Server sends `error: game_lost`, client shows message and exits:

```typescript
// Server
if (!game) {
  send(ws, { type: 'error', code: 'game_lost' })
  return
}

// Client
watch(() => store.gameLost, (lost) => {
  if (lost) emit('leave-game')
})
```

## Scaling Considerations (Future)

### Redis for Distributed State

When running multiple server instances behind a load balancer:

```typescript
// Socket.IO Redis adapter
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

const pubClient = createClient({ url: REDIS_URL })
const subClient = pubClient.duplicate()

io.adapter(createAdapter(pubClient, subClient))

// Now messages broadcast across all server instances
```

### Sticky Sessions

WebSocket connections must stay on the same server:

```nginx
# Nginx config
upstream backend {
  ip_hash;  # Sticky sessions based on IP
  server backend1:3000;
  server backend2:3000;
}
```

### Game State Persistence

For surviving server restarts:

```typescript
// Save game state to Redis/DB periodically
function persistGameState(game) {
  redis.set(`game:${game.id}`, JSON.stringify(game.serialize()))
  redis.expire(`game:${game.id}`, 3600)  // 1 hour TTL
}

// On server start, restore active games
async function restoreGames() {
  const keys = await redis.keys('game:*')
  for (const key of keys) {
    const data = await redis.get(key)
    if (data) {
      const game = Game.deserialize(JSON.parse(data))
      activeGames.set(game.id, game)
    }
  }
}
```

## Checklist for New Multiplayer Game

### Server Side
- [ ] Create `XxxGame.ts` with game logic
- [ ] Add message types to `shared/types.ts`
- [ ] Add handlers in `sessions/handlers.ts`
- [ ] Add routing in `ws/router.ts`
- [ ] Add validation in `ws/validation.ts`

### Client Side
- [ ] Create `xxxMultiplayerStore.ts`
- [ ] Create `useXxxGameAdapter.ts` 
- [ ] Create `useXxxDirector.ts`
- [ ] Create `XxxGameBoard.vue`
- [ ] Add to `App.vue` routing
- [ ] Add to lobby game type selection

### Testing
- [ ] Single player works
- [ ] Multiplayer connects and receives state
- [ ] Turns work correctly
- [ ] Animations don't cause flickering
- [ ] Reconnection handled gracefully
- [ ] Bug report captures game state
