# Turn Mechanics Architecture Analysis

## Executive Summary

This document evaluates the turn mechanics architecture across all games (Euchre, Spades, President) in both singleplayer (SP) and multiplayer (MP) modes. The goal is to assess efficiency, elegance, and opportunities for unification.

---

## Architecture Overview

### The Stack

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                            │
│  (GameBoard.vue - renders cards, handles clicks)            │
├─────────────────────────────────────────────────────────────┤
│                       Director Layer                        │
│  (useXxxDirector.ts - animations, UI state, seat mapping)   │
├─────────────────────────────────────────────────────────────┤
│                       Adapter Layer                         │
│  (useXxxGameAdapter.ts - unifies SP/MP interface)           │
├─────────────────────────────────────────────────────────────┤
│                        Store Layer                          │
│  SP: xxxGameStore.ts    │    MP: xxxMultiplayerStore.ts     │
│  (local game logic)     │    (server sync + local cache)    │
├─────────────────────────────────────────────────────────────┤
│                       Shared Layer                          │
│  (@67cards/shared - game rules, types, AI logic)            │
└─────────────────────────────────────────────────────────────┘
```

### Turn State Components

| Component | Description | Location |
|-----------|-------------|----------|
| `currentPlayer` | Whose turn it is (player ID) | Store |
| `isHumanTurn` / `isMyTurn` | Is it the human's turn? | Store (computed or ref) |
| `validCards` / `validPlays` | What can be played | Store (computed or ref) |
| `currentTurnSeat` | Visual seat for turn indicator | Director |
| `phase` | Game phase (bidding, playing, etc.) | Store |

---

## Singleplayer Architecture

### Pattern
All SP stores follow a similar pattern:

```typescript
// State
const currentPlayer = ref(0)
const phase = ref(Phase.Setup)

// Computed turn state
const isHumanTurn = computed(() => {
  const human = players.value.find(p => p.isHuman)
  return human && currentPlayer.value === human.id
})

// Computed valid plays
const validPlays = computed(() => {
  if (!isHumanTurn.value) return []
  return calculateLegalPlays(hand, gameState)
})
```

### Turn Flow (SP)

```
1. Human plays card
   → playCard(cardId) called
   → Game state updated synchronously
   → currentPlayer advances
   → isHumanTurn recomputes (false)
   → validPlays recomputes (empty)

2. AI turn runs
   → setTimeout or requestAnimationFrame
   → AI selects card
   → Game state updated
   → currentPlayer advances
   → Repeat until human's turn

3. Human's turn again
   → isHumanTurn recomputes (true)
   → validPlays recomputes (with legal cards)
```

### SP Complexity Assessment

| Game | Store Lines | Turn Logic Complexity |
|------|-------------|----------------------|
| Euchre | ~550 | HIGH - bidding rounds, going alone, dealer discard |
| Spades | ~360 | MEDIUM - bidding, blind nil reveal |
| President | ~500 | MEDIUM - multi-card plays, passing, pile clear |

**Key Observation:** SP is straightforward because everything is synchronous. Turn state is pure computed properties derived from `currentPlayer`.

---

## Multiplayer Architecture

### Pattern
MP stores are more complex due to network asynchrony:

```typescript
// State from server
const gameState = ref<GameState | null>(null)
const isMyTurn = ref(false)  // Set by server messages
const validCards = ref<string[]>([])  // Now computed locally (as of 2026-02-17)

// Message handling
function handleMessage(msg) {
  switch (msg.type) {
    case 'game_state':
      gameState.value = msg.state
      // May update isMyTurn based on currentPlayer
      break
    case 'your_turn':
      isMyTurn.value = true
      validActions.value = msg.validActions
      break
  }
}

// User action
function playCard(cardId) {
  websocket.send({ type: 'play_card', cardId })
  isMyTurn.value = false  // Optimistic
}
```

### Turn Flow (MP)

```
1. Human plays card
   → playCard(cardId) called
   → WebSocket message sent to server
   → isMyTurn = false (optimistic)
   → [NETWORK DELAY]

2. Server processes
   → Validates play
   → Updates game state
   → Determines next player
   → Broadcasts messages

3. Client receives
   → game_state message (new state)
   → your_turn message (if human's turn again)
   → isMyTurn = true
   → validCards computed from new state
```

### MP Message Types

| Game | Key Messages |
|------|--------------|
| Euchre | `game_state`, `your_turn`, `bid_made`, `card_played`, `trick_complete` |
| Spades | `spades_game_state`, `spades_your_turn`, `spades_bid_made`, `spades_card_played` |
| President | `president_game_state`, `president_your_turn`, `president_play_made`, `president_pile_cleared` |

### MP Complexity Assessment

| Game | Store Lines | Turn Logic Complexity | Queue Processing |
|------|-------------|----------------------|------------------|
| Euchre | ~600 | HIGH | Yes (for animations) |
| Spades | ~320 | MEDIUM | Yes |
| President | ~450 | MEDIUM | Yes |

---

## Current Inconsistencies

### 1. Naming Conventions

| Concept | Euchre | Spades | President |
|---------|--------|--------|-----------|
| Turn flag | `isMyTurn` | `isMyTurn` | `isMyTurn` |
| Human turn (SP) | N/A (no adapter) | `isHumanTurn` | `isHumanTurn` |
| Valid cards | `validCards` (IDs) | `validPlays` (Cards) | `validPlays` (Card[][]) |
| Turn actions | `validActions` | `validActions` | `validActions` |

### 2. Adapter Usage

| Game | Has Adapter | SP/MP Unified |
|------|-------------|---------------|
| Euchre | ✅ Yes | ✅ Yes |
| Spades | ✅ Yes | ✅ Yes |
| President | ✅ Yes | ✅ Yes |

**Good:** All games now have adapters that unify SP/MP interface.

### 3. Valid Cards Calculation

| Game | SP | MP (after 2026-02-17 fix) |
|------|----|----|
| Euchre | Computed locally | Computed locally |
| Spades | Computed locally | Computed locally |
| President | Computed locally | Computed locally |

**Good:** All games now use local computation for valid plays.

---

## Server Message Patterns

### The Two-Message Pattern

All MP games use a two-message pattern for turn transitions:

1. **`game_state`** - Full game state update
2. **`your_turn`** - Turn notification with valid actions

**Why two messages?**
- `game_state` is broadcast to all players
- `your_turn` is sent only to the active player (contains player-specific info)

**Problem:** Creates a race condition window where UI might flash.

**Current Solution:** Calculate valid plays locally, ignore server `validCards`.

### Alternative: Single Message Pattern

Could combine into one message per player:
```json
{
  "type": "game_update",
  "state": { ... },
  "isYourTurn": true,
  "validActions": ["play_card"],
  "validCards": ["hearts-A", "hearts-K"]
}
```

**Pros:** Atomic update, no flash window
**Cons:** Larger messages, more server logic, breaks existing pattern

**Recommendation:** Keep current pattern with local valid calculation.

---

## Turn Indicator Architecture

### Current Implementation

Each Director computes `currentTurnSeat`:

```typescript
// useEuchreDirector.ts
const currentTurnSeat = computed(() => {
  const cp = game.currentPlayer.value
  return cp >= 0 ? playerIdToSeatIndex(cp) : -1
})

// useSpadesDirector.ts
const currentTurnSeat = computed(() => {
  if (!game.isHumanTurn.value && game.currentPlayer.value === -1) return -1
  return playerIdToSeatIndex(game.currentPlayer.value)
})

// usePresidentDirector.ts
const currentTurnSeat = computed(() => {
  const cp = game.currentPlayer.value
  return cp >= 0 ? playerIdToSeatIndex(cp) : -1
})
```

**Observation:** Euchre and President are identical. Spades has extra guard.

### Seat Mapping

All games use the same pattern:
```typescript
function playerIdToSeatIndex(playerId: number): number {
  const myId = game.humanPlayer.value?.id ?? 0
  const count = playerCount.value
  return (playerId - myId + count) % count
}
```

User is always seat 0, opponents are 1, 2, 3 (clockwise).

---

## Opportunities for Unification

### 1. Shared Turn State Composable

Could extract common turn logic:

```typescript
// useMultiplayerTurnState.ts
export function useMultiplayerTurnState(options: {
  gameState: Ref<GameState | null>
  myPlayerId: ComputedRef<number>
  calculateValidPlays: (state: GameState) => string[]
}) {
  const isMyTurn = ref(false)
  const validPlays = computed(() => {
    if (!isMyTurn.value || !options.gameState.value) return []
    return options.calculateValidPlays(options.gameState.value)
  })
  
  function handleYourTurn() { isMyTurn.value = true }
  function handleAction() { isMyTurn.value = false }
  
  return { isMyTurn, validPlays, handleYourTurn, handleAction }
}
```

**Benefit:** Consistent behavior, less code duplication
**Effort:** Medium - requires refactoring all MP stores

### 2. Unified Message Queue

All MP games use `createMultiplayerQueueController`. This is already unified. ✅

### 3. Unified Director Turn Indicator

Could share `currentTurnSeat` computation:

```typescript
// In useCardController or new shared composable
function useCurrentTurnSeat(game: GameAdapter, playerIdToSeat: (id: number) => number) {
  return computed(() => {
    const cp = game.currentPlayer.value
    return cp >= 0 ? playerIdToSeat(cp) : -1
  })
}
```

**Benefit:** DRY
**Effort:** Low

---

## Efficiency Analysis

### Turn Transition Performance

| Step | SP | MP |
|------|----|----|
| State update | Sync (instant) | Async (network) |
| Turn determination | Computed (instant) | Ref + Message |
| Valid plays | Computed (instant) | Computed (instant) |
| UI update | Reactive (instant) | Reactive (instant) |

**Bottleneck:** Network latency in MP (unavoidable)

### Reactivity Efficiency

All turn state uses Vue's reactivity:
- `ref` for mutable state
- `computed` for derived state
- Updates trigger minimal re-renders

**Assessment:** Efficient. No unnecessary computations.

---

## Recommendations

### High Priority

1. **✅ DONE: Local valid plays calculation** - All games now compute locally

2. **Consider: Consolidate turn state into adapter**
   - Adapter already provides `isHumanTurn` / `validPlays`
   - Could move more turn logic there for consistency

### Medium Priority

3. **Standardize naming**
   - Pick one: `validCards` vs `validPlays`
   - Currently mixed based on game mechanics (single vs multi-card)

4. **Extract shared turn composable**
   - Reduce code duplication in MP stores
   - Ensure consistent behavior

### Low Priority

5. **Unify Director currentTurnSeat**
   - Minor DRY improvement
   - Low impact

6. **Document message flow**
   - Create sequence diagrams for MP turn flow
   - Helps onboarding

---

## Conclusion

The turn mechanics are **generally well-designed**:
- Clear separation between SP (synchronous) and MP (async)
- Adapters successfully unify the interface
- Local valid plays calculation eliminates flash issues
- Queue-based message processing handles animation sequencing

**Main area for improvement:** Reduce code duplication in MP stores by extracting a shared turn state composable.

**Flash issue in SP:** If flash is occurring in SP, it's not a turn mechanics issue — it's likely a Vue reactivity or rendering issue (CSS transitions, watch timing, etc.). Would need specific reproduction steps to diagnose.
