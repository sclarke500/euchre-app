# New Game Implementation Guide

**Purpose:** Step-by-step guide for adding a new multiplayer card game to the platform.

**Estimated effort:** 2-4 days for a standard trick-taking game.

---

## Before You Start

1. Read `docs/LLM_ONBOARDING.md` for architecture overview
2. Study one existing game as reference (Spades is cleanest)
3. Have game rules documented

---

## Phase 1: Shared Types (packages/shared)

### 1.1 Create game folder
```
packages/shared/src/{gamename}/
├── types.ts      # Game-specific types
├── game.ts       # Core game logic (optional, can be server-only)
├── ai.ts         # AI logic (optional)
└── index.ts      # Exports
```

### 1.2 Define types in `types.ts`

```typescript
// Example: packages/shared/src/hearts/types.ts

import type { Suit, FullRank } from '../core/types.js'

export interface HeartsCard {
  id: string
  suit: Suit
  rank: FullRank
}

export interface HeartsPlayer {
  id: number
  name: string
  hand: HeartsCard[]
  isHuman: boolean
  score: number
}

export type HeartsPhase = 'passing' | 'playing' | 'round_over' | 'game_over'

export interface HeartsTrick {
  cards: { playerId: number; card: HeartsCard }[]
  leadSuit: Suit | null
  winner: number | null
}

// Client state (what server sends to each player)
export interface HeartsClientGameState {
  gameType: 'hearts'
  players: HeartsClientPlayer[]  // Hand hidden for other players
  phase: HeartsPhase
  currentTrick: HeartsTrick
  currentPlayer: number
  dealer: number
  scores: number[]
  roundNumber: number
  heartsBroken: boolean
  stateSeq: number
  timedOutPlayer: number | null
}

export interface HeartsClientPlayer {
  id: number
  name: string
  hand?: HeartsCard[]      // Only included for requesting player
  handSize: number
  isHuman: boolean
  score: number
}
```

### 1.3 Add message types to `multiplayer.ts`

```typescript
// Add to packages/shared/src/multiplayer.ts

// Server → Client
export interface HeartsGameStateMessage {
  type: 'hearts_game_state'
  state: HeartsClientGameState
}

export interface HeartsYourTurnMessage {
  type: 'hearts_your_turn'
  validActions: string[]
  validCards: string[]
}

// Client → Server
export interface HeartsPlayCardMessage {
  type: 'hearts_play_card'
  cardId: string
  expectedStateSeq?: number
}

export interface HeartsPassCardsMessage {
  type: 'hearts_pass_cards'
  cardIds: string[]
  expectedStateSeq?: number
}

// Add to GameType union
export type GameType = 'euchre' | 'president' | 'spades' | 'hearts'

// Add to ServerMessage union
export type ServerMessage = 
  | ... existing ...
  | HeartsGameStateMessage
  | HeartsYourTurnMessage

// Add to ClientMessage union
export type ClientMessage =
  | ... existing ...
  | HeartsPlayCardMessage
  | HeartsPassCardsMessage
```

### 1.4 Export from index.ts

```typescript
// packages/shared/src/hearts/index.ts
export * from './types.js'

// packages/shared/src/index.ts - add export
export * from './hearts/index.js'
```

---

## Phase 2: Server Game Class (packages/server)

### 2.1 Create game class

```typescript
// packages/server/src/HeartsGame.ts

import type { HeartsClientGameState, HeartsCard } from '@euchre/shared'
import { getRandomAINames } from '@euchre/shared'

export interface HeartsGameEvents {
  onStateChange: (playerId: string | null, state: HeartsClientGameState) => void
  onYourTurn: (playerId: string, validActions: string[], validCards: string[]) => void
  onGameOver: (winnerId: number) => void
  onPlayerBooted: (playerIndex: number, newName: string) => void
}

export class HeartsGame {
  private gameId: string
  private players: HeartsPlayer[] = []
  private stateSeq = 0
  private events: HeartsGameEvents
  
  // ... game state ...
  
  constructor(gameId: string, events: HeartsGameEvents) {
    this.gameId = gameId
    this.events = events
  }
  
  // REQUIRED: Runtime interface methods
  initializePlayers(humans: { odusId: string; name: string; seatIndex: number }[]): void {
    // Create players, fill empty seats with AI
  }
  
  start(): void {
    this.dealCards()
    this.broadcastState()
    this.notifyCurrentPlayer()
  }
  
  resendStateToPlayer(odusId: string): void {
    const state = this.buildClientState(odusId)
    this.events.onStateChange(odusId, state)
    // Also send turn info if it's their turn
  }
  
  findPlayerIndexByOdusId(odusId: string): number {
    return this.players.findIndex(p => p.odusId === odusId)
  }
  
  replaceWithAI(playerIndex: number): boolean {
    const player = this.players[playerIndex]
    if (!player || !player.isHuman) return false
    
    player.isHuman = false
    player.name = getRandomAINames(1)[0] ?? 'Bot'
    player.odusId = null
    
    this.events.onPlayerBooted(playerIndex, player.name)
    this.broadcastState()
    
    // If it was their turn, AI takes over
    if (this.currentPlayer === playerIndex) {
      this.processAITurn()
    }
    
    return true
  }
  
  restoreHumanPlayer(seatIndex: number, odusId: string, name: string): boolean {
    const player = this.players[seatIndex]
    if (!player || player.isHuman) return false
    
    player.isHuman = true
    player.name = name
    player.odusId = odusId
    
    this.broadcastState()
    return true
  }
  
  bootPlayer(playerIndex: number): boolean {
    if (this.timedOutPlayer !== playerIndex) return false
    this.timedOutPlayer = null
    return this.replaceWithAI(playerIndex)
  }
  
  getPlayerInfo(odusId: string): { seatIndex: number; name: string } | null {
    const idx = this.findPlayerIndexByOdusId(odusId)
    if (idx < 0) return null
    return { seatIndex: idx, name: this.players[idx].name }
  }
  
  getStateSeq(): number {
    return this.stateSeq
  }
  
  // Game-specific methods
  handlePlayCard(odusId: string, cardId: string): boolean {
    // Validate and execute play
    // Call broadcastState() and notifyCurrentPlayer() after state change
  }
  
  private buildClientState(odusId: string | null): HeartsClientGameState {
    // Build filtered state (hide other players' hands)
  }
  
  private broadcastState(): void {
    this.stateSeq++
    for (const player of this.players) {
      if (player.odusId) {
        this.events.onStateChange(player.odusId, this.buildClientState(player.odusId))
      }
    }
    // Spectator view
    this.events.onStateChange(null, this.buildClientState(null))
  }
}
```

### 2.2 Register in runtime registry

```typescript
// packages/server/src/sessions/registry.ts

import type { HeartsGame } from '../HeartsGame.js'

export const heartsGames = new Map<string, HeartsGame>()

// Add to getRuntime() function
```

### 2.3 Add handlers

```typescript
// packages/server/src/sessions/handlers.ts

// Add to createSessionHandlers:
// - Game creation in handleStartGame
// - Message routing for hearts_play_card, etc.
```

### 2.4 Add routing

```typescript
// packages/server/src/ws/router.ts

// Add case for 'hearts_play_card':
case 'hearts_play_card':
  handlers.heartsPlayCard(ws, client, message.cardId)
  break
```

---

## Phase 3: Client Store (packages/client)

### 3.1 Create multiplayer store

```typescript
// packages/client/src/games/hearts/heartsMultiplayerStore.ts

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { websocket } from '@/services/websocket'
import { createMultiplayerQueueController } from '@/stores/multiplayerQueue'
import { createResyncController } from '@/stores/multiplayerResync'
import { updateIfChanged } from '@/stores/utils'
import type { HeartsClientGameState, ServerMessage } from '@euchre/shared'

export const useHeartsMultiplayerStore = defineStore('heartsMultiplayer', () => {
  // State
  const gameState = ref<HeartsClientGameState | null>(null)
  const isMyTurn = ref(false)
  const validActions = ref<string[]>([])
  const validCards = ref<string[]>([])
  const gameLost = ref(false)
  const lastStateSeq = ref(0)
  
  // Queue controller for animation sync
  const queue = createMultiplayerQueueController<ServerMessage>(applyMessage)
  
  // Resync controller
  const resync = createResyncController(/* config */)
  
  function applyMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'hearts_game_state':
        gameState.value = message.state
        lastStateSeq.value = message.state.stateSeq
        break
        
      case 'hearts_your_turn':
        updateIfChanged(isMyTurn, true)
        updateIfChanged(validActions, message.validActions)
        updateIfChanged(validCards, message.validCards)
        break
        
      case 'error':
        if (message.code === 'game_lost') {
          gameLost.value = true
        }
        break
    }
  }
  
  function handleMessage(message: ServerMessage): void {
    if (queue.isEnabled()) {
      queue.enqueue(message)
    } else {
      applyMessage(message)
    }
  }
  
  // Actions
  function playCard(cardId: string): void {
    websocket.send({
      type: 'hearts_play_card',
      cardId,
      expectedStateSeq: lastStateSeq.value,
    })
    isMyTurn.value = false
  }
  
  // Lifecycle
  let unsubscribe: (() => void) | null = null
  
  function initialize(): void {
    if (unsubscribe) return
    unsubscribe = websocket.onMessage(handleMessage)
  }
  
  function cleanup(): void {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    gameState.value = null
    queue.clear()
    gameLost.value = false
  }
  
  return {
    gameState,
    isMyTurn,
    validActions,
    validCards,
    gameLost,
    playCard,
    initialize,
    cleanup,
    enableQueueMode: queue.enable,
    disableQueueMode: queue.disable,
  }
})
```

---

## Phase 4: Client Adapter & Director

### 4.1 Create adapter

```typescript
// packages/client/src/games/hearts/useHeartsGameAdapter.ts

import { computed } from 'vue'
import { useHeartsStore } from './heartsStore'
import { useHeartsMultiplayerStore } from './heartsMultiplayerStore'

export function useHeartsGameAdapter(mode: 'singleplayer' | 'multiplayer') {
  if (mode === 'multiplayer') {
    return useHeartsMultiplayerAdapter()
  }
  return useHeartsSinglePlayerAdapter()
}

function useHeartsMultiplayerAdapter() {
  const store = useHeartsMultiplayerStore()
  
  return {
    // Computed properties wrapping store state
    phase: computed(() => store.gameState?.phase ?? 'waiting'),
    players: computed(() => /* transform to adapter format */),
    isHumanTurn: computed(() => store.isMyTurn),
    validCards: computed(() => store.validCards),
    gameLost: store.gameLost,
    
    // Actions
    playCard: store.playCard,
    
    // Lifecycle
    initialize: store.initialize,
    cleanup: store.cleanup,
    enableQueueMode: store.enableQueueMode,
    disableQueueMode: store.disableQueueMode,
    
    isMultiplayer: true,
  }
}
```

### 4.2 Create director

```typescript
// packages/client/src/games/hearts/useHeartsDirector.ts

import { ref, watch } from 'vue'
import type { useHeartsGameAdapter } from './useHeartsGameAdapter'

export function useHeartsDirector(
  adapter: ReturnType<typeof useHeartsGameAdapter>,
  engine: CardTableEngine
) {
  const isAnimating = ref(false)
  
  // Seat rotation: human always at bottom (seat 0)
  function playerIdToSeat(playerId: number): number {
    const myId = adapter.humanPlayer.value?.id ?? 0
    return (playerId - myId + 4) % 4
  }
  
  // Watch for plays and animate
  watch(() => adapter.lastPlay.value, async (play) => {
    if (!play) return
    
    isAnimating.value = true
    adapter.enableQueueMode?.()
    
    await engine.animateCardToCenter(play.card, playerIdToSeat(play.playerId))
    
    adapter.disableQueueMode?.()
    isAnimating.value = false
  })
  
  return {
    playerIdToSeat,
    isAnimating,
    currentTurnSeat: computed(() => playerIdToSeat(adapter.currentPlayer.value)),
  }
}
```

---

## Phase 5: Client UI Component

### 5.1 Create game board

```vue
<!-- packages/client/src/games/hearts/HeartsEngineBoard.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useHeartsGameAdapter } from './useHeartsGameAdapter'
import { useHeartsDirector } from './useHeartsDirector'
import { useCardTable } from '@/composables/useCardTable'
import CardTable from '@/components/CardTable.vue'
import GameHUD from '@/components/GameHUD.vue'

const props = defineProps<{
  mode: 'singleplayer' | 'multiplayer'
}>()

const emit = defineEmits<{
  leaveGame: []
}>()

const engine = useCardTable()
const adapter = useHeartsGameAdapter(props.mode)
const director = useHeartsDirector(adapter, engine)

onMounted(() => {
  adapter.initialize?.()
})

onUnmounted(() => {
  adapter.cleanup?.()
})

function handleCardClick(cardId: string) {
  if (!adapter.isHumanTurn.value) return
  if (!adapter.validCards.value.includes(cardId)) return
  adapter.playCard(cardId)
}
</script>

<template>
  <CardTable
    :player-count="4"
    :player-names="director.playerNames.value"
    :engine="engine"
    :current-turn-seat="director.currentTurnSeat.value"
    :dimmed-card-ids="dimmedCardIds"
    @card-click="handleCardClick"
  >
    <GameHUD
      game-type="hearts"
      :build-payload="buildBugReportPayload"
      @leave="emit('leaveGame')"
    />
    
    <!-- Game-specific UI: scoreboard, etc. -->
  </CardTable>
</template>
```

---

## Phase 6: Integration

### 6.1 Add to App.vue routing
### 6.2 Add to MainMenu.vue
### 6.3 Add to lobby game type selector

---

## Phase 7: Testing

### 7.1 Manual testing checklist

- [ ] Single-player game completes
- [ ] Multiplayer: create table → start → first turn
- [ ] Multiplayer: mid-game disconnect → AI replacement
- [ ] Multiplayer: reconnect → seat restored
- [ ] Turn timer appears and works
- [ ] Bug report captures game state

### 7.2 E2E test

```typescript
// e2e/tests/hearts.spec.ts
import { test, expect } from '@playwright/test'

test('Hearts single player starts', async ({ page }) => {
  await page.goto('/')
  await page.click('text=Hearts')
  await page.click('text=Single Player')
  await expect(page.locator('.hearts-board')).toBeVisible()
})
```

---

## Reference Implementation

Study these files for the cleanest example (Spades):

```
packages/shared/src/spades/types.ts
packages/server/src/SpadesGame.ts
packages/client/src/games/spades/spadesMultiplayerStore.ts
packages/client/src/games/spades/useSpadesGameAdapter.ts
packages/client/src/games/spades/useSpadesDirector.ts
packages/client/src/games/spades/SpadesEngineBoard.vue
```
