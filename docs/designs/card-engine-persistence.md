# Card Engine State Persistence — Implementation Plan

**Status:** Ready for implementation  
**Last Updated:** 2026-02-21  
**Reviews:** GPT (card-engine-persistence-review.md), Grok (card-engine-persistence-analysis.md)

---

## Problem

When browser tab sleeps or WebSocket reconnects, card engine visual state is lost. Components unmount, refs disappear, and we rebuild from server state — causing 2-5 second delays and visual glitches.

## Solution

Persist **semantic card state** (ownership, order, face-up) to sessionStorage. On wake/reconnect, restore instantly from local snapshot, then validate against server state.

**Key principle:** Persist *what cards exist where*, not *pixel coordinates*. Recompute positions from current layout.

---

## Snapshot Schema

```typescript
interface CardEngineSnapshot {
  version: 1
  savedAt: number
  gameType: 'euchre' | 'spades' | 'president' | 'klondike'
  sessionKey: string
  
  // Server state fingerprint — used to detect stale snapshots
  fingerprint: {
    stateSeq: number
    phase: string
    dealer?: number
    currentPlayer?: number
    trickCount?: number
    myHandHash: string  // sorted card IDs joined, for quick comparison
  }
  
  // Semantic container state (no coordinates)
  containers: {
    deck: ContainerSnapshot | null
    hands: HandSnapshot[]
    piles: PileSnapshot[]
  }
  
  // Card registry — allows reconstructing cards without server
  cards: Record<string, { suit: string; rank: string }>
}

interface ContainerSnapshot {
  id: string
  cardIds: string[]  // Order matters for positioning
}

interface HandSnapshot extends ContainerSnapshot {
  mode: 'fanned' | 'looseStack'
  faceUp: boolean
}

interface PileSnapshot extends ContainerSnapshot {
  // For trick piles, store count per player for reconstruction
  metadata?: Record<string, unknown>
}
```

**Storage key:** `cardEngine:${gameType}:${sessionKey}`

---

## Two-Stage Restore Lifecycle

### Stage 1: Instant Local Restore (on mount/wake)

```typescript
function attemptLocalRestore(): boolean {
  const snapshot = loadSnapshot(gameType, sessionKey)
  if (!snapshot) return false
  
  // Check age (max 5 minutes)
  if (Date.now() - snapshot.savedAt > 5 * 60 * 1000) {
    clearSnapshot()
    return false
  }
  
  // Reconstruct containers from semantic state
  for (const hand of snapshot.containers.hands) {
    const engineHand = engine.getHand(hand.id)
    if (!engineHand) continue
    
    engineHand.mode = hand.mode
    for (const cardId of hand.cardIds) {
      const cardData = snapshot.cards[cardId]
      if (cardData) {
        engineHand.addCard({ id: cardId, ...cardData }, hand.faceUp)
      }
    }
  }
  
  // Similar for piles...
  
  // Recompute positions from current layout
  repositionAllContainers()
  
  return true
}
```

### Stage 2: Server Reconciliation (when game_state arrives)

```typescript
function reconcileWithServer(serverState: GameState): void {
  const snapshot = loadSnapshot(gameType, sessionKey)
  if (!snapshot) return  // Nothing to reconcile
  
  // Compare fingerprints
  const serverFingerprint = buildFingerprint(serverState)
  
  if (fingerprintsMatch(snapshot.fingerprint, serverFingerprint)) {
    // Snapshot is valid — keep visuals, clear pending restore flag
    return
  }
  
  // Fingerprint mismatch — server state diverged while sleeping
  // Discard snapshot and rebuild from server
  clearSnapshot()
  rebuildFromServerState(serverState)
}

function fingerprintsMatch(a: Fingerprint, b: Fingerprint): boolean {
  return a.stateSeq === b.stateSeq
    && a.phase === b.phase
    && a.myHandHash === b.myHandHash
}
```

---

## Save Triggers

1. **`visibilitychange`** — when `document.hidden` becomes true
2. **`pagehide`** — backup for iOS Safari
3. **Debounced after card movements** — 500ms after animation batch completes

**Rules:**
- Never save mid-animation (check `isAnimating` flag)
- Only save if state is dirty (cards moved since last save)
- Mark dirty on: card move, card add/remove, mode change

```typescript
// In useCardController
let isDirty = false
let saveTimeout: number | null = null

function markDirty() {
  isDirty = true
  if (persistence?.enabled && saveTimeout === null) {
    saveTimeout = window.setTimeout(() => {
      if (isDirty && !isAnimating.value) {
        saveSnapshot()
        isDirty = false
      }
      saveTimeout = null
    }, 500)
  }
}

// Visibility change handler
document.addEventListener('visibilitychange', () => {
  if (document.hidden && persistence?.enabled && isDirty && !isAnimating.value) {
    saveSnapshot()
    isDirty = false
  }
})
```

---

## API

### useCardController config

```typescript
interface CardControllerConfig {
  // ... existing config ...
  
  persistence?: {
    enabled: boolean
    gameType: 'euchre' | 'spades' | 'president' | 'klondike'
    sessionKey: string | (() => string)
    getFingerprint: () => Fingerprint  // Game provides this
  }
}
```

### Returned methods

```typescript
interface CardController {
  // ... existing methods ...
  
  // Persistence
  attemptLocalRestore(): boolean
  reconcileWithServer(fingerprint: Fingerprint): void
  saveSnapshot(): void
  clearSnapshot(): void
}
```

### Game integration example

```typescript
// In useEuchreDirector
const cardController = useCardController(engine, boardRef, {
  ...cardControllerPresets.euchre,
  persistence: {
    enabled: game.isMultiplayer,
    gameType: 'euchre',
    sessionKey: () => game.lobbyCode.value ?? 'sp',
    getFingerprint: () => ({
      stateSeq: game.stateSeq.value,
      phase: game.phase.value,
      dealer: game.dealer.value,
      currentPlayer: game.currentPlayer.value,
      trickCount: game.tricksTaken.value?.[0] + game.tricksTaken.value?.[1],
      myHandHash: game.myHand.value?.map(c => c.id).sort().join(',') ?? '',
    }),
  },
})

// On mount
onMounted(() => {
  if (!cardController.attemptLocalRestore()) {
    setupTable()  // Fall back to normal setup
  }
})

// In game_state handler
case 'game_state': {
  game.applyMessage!(msg)
  cardController.reconcileWithServer(buildFingerprint(msg.state))
  // ... rest of handler
}

// On game end/leave
function leaveGame() {
  cardController.clearSnapshot()
  // ... cleanup
}
```

---

## File Changes

### New file: `packages/client/src/composables/useCardPersistence.ts`

```typescript
// Snapshot serialization/deserialization
// Storage operations
// Fingerprint comparison
export function serializeEngine(engine: CardTableEngine, fingerprint: Fingerprint): CardEngineSnapshot
export function deserializeToEngine(snapshot: CardEngineSnapshot, engine: CardTableEngine): void
export function loadSnapshot(gameType: string, sessionKey: string): CardEngineSnapshot | null
export function saveSnapshot(snapshot: CardEngineSnapshot): void
export function clearSnapshot(gameType: string, sessionKey: string): void
```

### Modified: `packages/client/src/composables/useCardController.ts`

- Add persistence config option
- Add `attemptLocalRestore()`, `reconcileWithServer()`, `saveSnapshot()`, `clearSnapshot()`
- Add dirty tracking and save triggers
- Wire up visibility change listener

### Modified: `packages/client/src/components/cardContainers.ts`

- Add `toSnapshot()` method to Hand, Pile, Deck classes
- Add static `fromSnapshot()` factory methods

### Modified: Directors

- `useEuchreDirector.ts` — add persistence config, mount restore, reconcile in game_state
- `useSpadesDirector.ts` — same
- `usePresidentDirector.ts` — same

---

## Implementation Phases

### Phase 1: Core Infrastructure (2-3 hours)
- [ ] Create `useCardPersistence.ts` with serialize/deserialize
- [ ] Add `toSnapshot()` to container classes
- [ ] Add persistence config to `useCardController`
- [ ] Implement save triggers (visibility, debounced)
- [ ] Unit tests for serialization

### Phase 2: Euchre MP Integration (1-2 hours)
- [ ] Add fingerprint builder to Euchre adapter/director
- [ ] Enable persistence in director
- [ ] Add `attemptLocalRestore()` on mount
- [ ] Add `reconcileWithServer()` in game_state handler
- [ ] Clear on game end/leave
- [ ] Manual testing: sleep/wake scenarios

### Phase 3: Remaining Games (1-2 hours)
- [ ] Spades MP integration
- [ ] President MP integration
- [ ] Cross-game testing

### Phase 4: Polish (1 hour)
- [ ] Add logging for debugging
- [ ] Handle edge cases (storage quota, corrupted data)
- [ ] Update daily memory with lessons learned

---

## Test Scenarios

Must pass before shipping:

1. **Basic wake** — Lock phone 30s during play, unlock → cards visible immediately
2. **Reconnect** — Force WebSocket disconnect, reconnect → no blank period
3. **Stale discard** — Sleep through phase transition → snapshot discarded, rebuild correct
4. **Orientation** — Rotate while sleeping → restored positions correct for new layout
5. **Tab isolation** — Two tabs with different games → no cross-contamination
6. **Game end** — Complete game → snapshot cleared, no restore on new game

---

## Open Questions (Resolved)

1. ~~Save frequency~~ → Visibility change + 500ms debounce after moves
2. ~~Reconciliation strategy~~ → Two-stage: instant local, then server validation
3. ~~Single-player~~ → Defer; SP already has save/restore. Focus on MP first.

---

## References

- GPT Review: `docs/designs/card-engine-persistence-review.md`
- Grok Analysis: `docs/designs/card-engine-persistence-analysis.md`
- cardgames.io approach: localStorage for stats, no dynamic backend for SP
