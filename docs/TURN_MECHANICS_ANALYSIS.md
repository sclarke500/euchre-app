# Turn Mechanics Analysis

## Overview

This document analyzes how turn state is managed across all games in both singleplayer (SP) and multiplayer (MP) modes, with focus on:
1. How `isMyTurn` / `isHumanTurn` is determined
2. How `validCards` / `validPlays` is set and cleared
3. When and how turns transition
4. Flash/flicker issues and their causes

---

## Current State by Game

### Euchre

#### Singleplayer
- **Turn determination**: `isHumanTurn` computed from `gameState.currentPlayer === 0`
- **Valid cards**: Computed locally from hand + trick state using `getLegalPlays()`
- **Turn transition**: Synchronous - game state updates, computed reacts
- **Flash risk**: LOW - pure computed, no async gaps

#### Multiplayer
- **Turn determination**: `isMyTurn` ref, set by messages
- **Valid cards**: `validCards` ref, filled from server OR locally
- **Turn transition**: 
  1. User action → immediately set `isMyTurn = false`, clear `validCards`
  2. Server sends `game_state` 
  3. Server sends `your_turn` → set `isMyTurn = true`, update `validCards`
- **Flash risk**: HIGH
  - Gap between user action clearing state and next `your_turn` arriving
  - `game_state` doesn't restore `isMyTurn` (intentionally, to prevent flash)
  - Local fallback fills `validCards` when empty, but only in `game_state` handler

**Euchre MP Turn Flow:**
```
User plays card
  → isMyTurn = false
  → validCards = []
  → [FLASH WINDOW - cards not highlighted]
  
Server sends game_state
  → If our turn detected: validCards filled locally (if empty)
  → isMyTurn stays false (to prevent premature interaction)
  
Server sends your_turn
  → isMyTurn = true
  → validCards = server value (overwrites local)
```

---

### Spades

#### Singleplayer
- **Turn determination**: `isHumanTurn` computed from `gameState.currentPlayer === 0`
- **Valid plays**: Computed locally using `getLegalPlays()`
- **Turn transition**: Synchronous
- **Flash risk**: LOW

#### Multiplayer
- **Turn determination**: `isMyTurn` ref, set by messages
- **Valid plays**: NOW computed locally (as of 2026-02-17 fix)
  ```ts
  validPlays = computed(() => {
    if (!isMyTurn.value || phase.value !== SpadesPhase.Playing) return []
    return Spades.getLegalPlays(human.hand, trick, spadesBroken)
  })
  ```
- **Turn transition**:
  1. User action → `isMyTurn = false`, clear `validCards`
  2. Server sends `game_state` → may clear `isMyTurn` if not our turn
  3. Server sends `your_turn` → `isMyTurn = true`, update `validCards`
- **Flash risk**: MEDIUM
  - `validPlays` is now computed from `isMyTurn`, so it updates instantly
  - But `validCards` ref still cleared on action (legacy, possibly unused)

---

### President

#### Singleplayer
- **Turn determination**: `isHumanTurn` computed from `gameState.currentPlayer === humanPlayerId`
- **Valid plays**: Computed locally using `findValidPlays()`
- **Turn transition**: Synchronous
- **Flash risk**: LOW

#### Multiplayer
- **Turn determination**: `isMyTurn` ref, set by messages
- **Valid plays**: NOW computed locally (as of 2026-02-17 fix)
  ```ts
  validPlays = computed(() => {
    if (!store.isMyTurn) return []
    return findValidPlays(store.myHand, store.currentPile, store.superTwosMode)
  })
  ```
- **Turn transition**:
  1. User action → `isMyTurn = false` (validPlays NOT cleared since 2026-02-17)
  2. Server sends `game_state` → conditional `isMyTurn` update
  3. Server sends `your_turn` → `isMyTurn = true`, update `validPlays` ref
- **Flash risk**: LOW (after fix)
  - `validPlays` computed from local calculation
  - Only `isMyTurn` changes, not the valid cards list

---

## The Flash Problem

### Root Cause
In MP, the pattern is:
1. **Optimistic clear**: User action immediately clears turn state
2. **Network delay**: Wait for server response
3. **Server restore**: `your_turn` message restores turn state

During step 2, UI shows cards as non-playable (flash).

### Why It Exists
The optimistic clear prevents:
- Double-submissions (user clicks again while waiting)
- Stale highlights if turn passes to another player

### Current Mitigations

| Game | Mitigation |
|------|------------|
| President | Local `validPlays` computed, don't clear on action |
| Spades | Local `validPlays` computed |
| Euchre | Local fallback in `game_state` handler, but still clears first |

---

## Inconsistencies Found

### 1. Euchre still clears validCards on action
```ts
// euchreMultiplayerStore.ts
isMyTurn.value = false
validCards.value = []  // ← CAUSES FLASH
```

### 2. Euchre uses validCards ref, others use computed
- **Euchre**: `validCards` is a ref, filled from server or local fallback
- **Spades/President**: `validPlays` is computed from local calculation

### 3. Euchre has hybrid approach
Euchre tries to fill `validCards` locally in `game_state` handler:
```ts
if (validCards.value.length === 0) {
  validCards.value = getLegalPlays(myHand, trick, trump).map(c => c.id)
}
```
But it already cleared `validCards` on action, so there's still a flash window.

### 4. Different naming
- Euchre/Spades: `validCards` (card IDs)
- President: `validPlays` (arrays of card IDs for multi-card plays)
- Adapter layer normalizes to `validCards` or `validPlays` per game

---

## Proposed Unification

### Option A: Full Local Calculation (Recommended)

All games compute valid plays locally, never rely on server `your_turn.validCards`:

```ts
// Unified pattern for all MP stores
const validPlays = computed(() => {
  if (!isMyTurn.value) return []
  if (phase.value !== PlayingPhase) return []
  return calculateLocalValidPlays(hand, gameState)
})
```

**Changes needed:**
- Euchre MP: Switch from `validCards` ref to computed
- Remove all `validCards.value = []` clears on user action
- Server `your_turn.validCards` becomes optional (for validation/logging only)

**Benefits:**
- Zero flash - computed updates synchronously
- Simpler code - no ref management
- Consistent pattern across all games

### Option B: Delayed Clear with Debounce

Keep server as source of truth, but delay clearing:
```ts
function playCard(cardId) {
  sendToServer(cardId)
  // Don't clear immediately - wait for server response
  // If server confirms turn passed, then clear
}
```

**Problems:**
- More complex
- Risk of stale state if server is slow
- Double-click possible if not handled

### Option C: Optimistic State Machine

Track turn state as a state machine:
```ts
type TurnState = 
  | { status: 'waiting' }
  | { status: 'myTurn', validCards: string[] }
  | { status: 'actionPending', cardPlayed: string }
  | { status: 'otherTurn' }
```

**Problems:**
- More complex
- Overkill for this use case

---

## Recommended Fix for Euchre

Apply the same pattern as President/Spades:

```ts
// euchreMultiplayerStore.ts

// Change validCards from ref to computed
const validCards = computed<string[]>(() => {
  if (!isMyTurn.value) return []
  
  const phase = gameState.value?.phase
  if (phase === 'playing') {
    return getLegalPlays(myHand.value, currentTrick.value, trumpSuit).map(c => c.id)
  }
  if (phase === 'bidding_round_1' || phase === 'bidding_round_2') {
    // During bidding, all cards are "valid" (for display, bid buttons handle actual bids)
    return (myHand.value ?? []).map(c => c.id)
  }
  return []
})

// Remove all instances of:
// - validCards.value = []
// - updateIfChanged(validCards, message.validCards ?? [])
```

---

## Action Plan

### Phase 1: Euchre Local ValidCards (Priority)
1. Change `validCards` from ref to computed
2. Remove all manual clears/sets
3. Test bidding + playing phases

### Phase 2: Audit Turn Transitions
1. Review all `isMyTurn = false` calls
2. Ensure they only happen when appropriate
3. Consider keeping `isMyTurn = true` until server confirms turn passed

### Phase 3: Unify Naming (Optional)
- Standardize on `validPlays` everywhere
- Or `validCards` for single-card games, `validPlays` for multi-card

---

## Testing Checklist

After changes, verify no flash in:
- [ ] Euchre MP: User plays card during trick
- [ ] Euchre MP: User bids during bidding round
- [ ] Euchre MP: Dealer discards after picking up
- [ ] Spades MP: User plays card
- [ ] Spades MP: User makes bid
- [ ] President MP: User plays single/multi card
- [ ] President MP: User passes

---

## Summary

| Game | SP Turn | MP Turn | ValidCards Source | Flash Risk |
|------|---------|---------|-------------------|------------|
| Euchre | computed | ref | ref (server + local fallback) | HIGH |
| Spades | computed | ref | computed (local) | LOW |
| President | computed | ref | computed (local) | LOW |

**Euchre needs the same fix as Spades/President**: switch `validCards` from ref to computed local calculation.
