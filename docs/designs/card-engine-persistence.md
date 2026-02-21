# Card Engine State Persistence

## Problem

When the browser tab sleeps (screen off, tab backgrounded) or WebSocket reconnects, the card engine's visual state is lost. Vue components unmount, and we have to rebuild from server state. This causes:

1. Delay while waiting for server sync
2. Visual glitches (cards in wrong position/scale)
3. Edge cases we keep patching (user hand, trick piles, etc.)

## Goal

Persist card engine state locally so reconnects/wakes restore instantly. Should work for all games (Euchre, Spades, President, Klondike) with minimal game-specific code.

## Design

### What to Persist

The entire `CardTableEngine` state:

```typescript
interface PersistedEngineState {
  version: number              // Schema version for migrations
  timestamp: number            // When state was saved
  sessionId: string            // Game session identifier
  
  deck: PersistedContainer | null
  hands: PersistedContainer[]
  piles: PersistedContainer[]
  
  // Optional game-specific visual state
  extras?: Record<string, unknown>
}

interface PersistedContainer {
  id: string
  type: 'deck' | 'hand' | 'pile'
  position: { x: number; y: number }
  scale: number
  rotation: number
  mode?: 'fanned' | 'stacked' | 'looseStack'
  
  cards: PersistedCard[]
}

interface PersistedCard {
  id: string
  suit: string
  rank: string
  faceUp: boolean
  position: { x: number; y: number }
  rotation: number
  scale: number
  zIndex: number
}
```

### Storage

**sessionStorage** (recommended):
- Per-tab isolation (no multi-tab conflicts)
- Automatically cleared when tab closes
- ~5MB limit (plenty for card state)

**Key format:** `cardEngine:${gameType}:${sessionId}`

Example: `cardEngine:euchre:lobby-abc123`

### When to Save

Two strategies:

1. **On state change** - After each card movement completes
   - Pros: Always up to date
   - Cons: Frequent writes

2. **On visibility change** - When `document.hidden` becomes true
   - Pros: Fewer writes
   - Cons: Might miss state if browser kills tab instantly

**Recommendation:** Hybrid approach:
- Save on visibility change (primary)
- Debounced save after card movements (backup, 500ms debounce)

### When to Restore

On `useCardController` initialization:
1. Check for persisted state matching current sessionId
2. If found and recent (< 5 min old), restore it
3. Skip server sync for visual state (cards already positioned)
4. Still sync game logic state from server (scores, turn, etc.)

### API

```typescript
// In useCardController
interface CardControllerConfig {
  // ... existing config ...
  
  // Persistence options
  persistence?: {
    enabled: boolean
    sessionId: string | (() => string)
    gameType: string
    maxAge?: number  // Max age in ms before state is stale (default: 5min)
  }
}

// Returned from useCardController
interface CardController {
  // ... existing methods ...
  
  // Manual persistence control
  persistState(): void
  clearPersistedState(): void
  hasPersistedState(): boolean
}
```

### Implementation Phases

**Phase 1: Core Persistence (useCardController)**
- Add serialize/deserialize functions to CardTableEngine
- Add persistence config to useCardController
- Implement save on visibility change
- Implement restore on mount

**Phase 2: Game Integration**
- Add sessionId to each game's director/adapter
- Enable persistence in Euchre MP
- Test reconnect scenarios

**Phase 3: Rollout to Other Games**
- Spades MP
- President MP
- Klondike (single-player, different sessionId strategy)

### Edge Cases

1. **Stale state**: If server state has advanced (new hand dealt), persisted state is wrong
   - Solution: Include `stateSeq` or equivalent in extras, compare on restore
   - If mismatch, discard persisted state and rebuild from server

2. **Game ended**: Don't restore state for a finished game
   - Solution: Clear persisted state on game over

3. **Multiple games**: Player joins different lobby
   - Solution: sessionId includes lobby/game ID, old state ignored

4. **Tab duplication**: User duplicates tab
   - Solution: sessionStorage is per-tab, each tab has own state

### File Changes

```
packages/client/src/
├── composables/
│   ├── useCardController.ts    # Add persistence logic
│   └── useCardPersistence.ts   # New: serialize/deserialize helpers
├── components/
│   └── cardContainers.ts       # Add toJSON/fromJSON methods
└── games/
    ├── euchre/
    │   └── useEuchreDirector.ts  # Pass sessionId to controller
    ├── spades/
    │   └── useSpadesDirector.ts
    └── president/
        └── usePresidentDirector.ts
```

### Example Usage

```typescript
// In useEuchreDirector
const cardController = useCardController(engine, boardRef, {
  ...cardControllerPresets.euchre,
  persistence: {
    enabled: game.isMultiplayer,
    sessionId: () => game.lobbyCode.value ?? 'sp',
    gameType: 'euchre',
  }
})
```

### Success Metrics

- Reconnect shows cards instantly (< 100ms)
- No visual glitches on wake
- Works across all multiplayer games
- Zero game-specific persistence code

---

## Open Questions

1. Should we persist on every card move (debounced) or only on visibility change?
2. How to handle state reconciliation if server has diverged?
3. Should single-player games use this? (They already have save/restore)

## Review Requested

- Architecture soundness
- Edge cases we're missing
- API ergonomics
- Performance concerns
