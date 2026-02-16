# LLM Onboarding Guide

**Purpose:** Get an LLM up to speed quickly on this codebase's architecture, patterns, and conventions.

**Read time:** 5 minutes

---

## What Is This?

A multiplayer card game platform (PWA) with:
- **Games:** Euchre, President, Spades (multiplayer), Klondike (single-player)
- **Stack:** Vue 3 + TypeScript frontend, Node + WebSocket backend
- **Deploy:** Netlify (frontend), Render (backend)

---

## Monorepo Structure

```
packages/
├── client/          # Vue 3 + Vite frontend
│   └── src/
│       ├── games/          # Game-domain folders (euchre, president, spades, klondike)
│       ├── components/     # Shared Vue UI components
│       ├── composables/    # Shared composables (card table/engine helpers)
│       └── stores/         # Shared multiplayer utilities + lobby state
├── server/          # Node WebSocket server
│   └── src/
│       ├── Game.ts              # Euchre game logic
│       ├── PresidentGame.ts     # President game logic
│       ├── SpadesGame.ts        # Spades game logic
│       ├── sessions/            # Multiplayer orchestration
│       └── ws/                  # WebSocket routing
└── shared/          # Shared types, rules, utilities
    └── src/
        ├── core/        # Base card types (Suit, Rank, Card)
        ├── euchre/      # Euchre-specific types
        ├── president/   # President-specific types
        ├── spades/      # Spades-specific types
        ├── klondike/    # Klondike-specific types/logic
        └── multiplayer.ts   # Shared multiplayer message types
```

---

## Canonical Patterns

### Client Architecture (per multiplayer game)

```
Store → Adapter → Director → Board
```

| Layer | File Pattern | Responsibility |
|-------|--------------|----------------|
| **Store** | `*MultiplayerStore.ts` | WebSocket, raw server state, turn tracking |
| **Adapter** | `use*GameAdapter.ts` | Unified API for single/multiplayer modes |
| **Director** | `use*Director.ts` | Animation orchestration, queue coordination |
| **Board** | `*GameBoard.vue` | Rendering + user interactions only |

### Server Architecture

```
Router → Handlers → GameRuntime → Game Class
```

| Layer | File | Responsibility |
|-------|------|----------------|
| **Router** | `ws/router.ts` | Message type → handler dispatch |
| **Handlers** | `sessions/handlers.ts` | Game creation, restart, state requests |
| **Runtime** | `sessions/runtime.ts` | Unified interface for all games |
| **Registry** | `sessions/registry.ts` | Active game instances |
| **Game Class** | `*Game.ts` | Game rules, state, AI |

---

## Key Files to Read First

### Understanding the architecture:
1. `packages/shared/src/multiplayer.ts` — Message types
2. `packages/server/src/sessions/runtime.ts` — Server game interface
3. `packages/client/src/games/spades/useSpadesGameAdapter.ts` — Adapter pattern example

### Understanding a complete game:
1. `packages/shared/src/spades/` — Types and rules
2. `packages/server/src/SpadesGame.ts` — Server implementation
3. `packages/client/src/games/spades/spadesMultiplayerStore.ts` — Client store
4. `packages/client/src/games/spades/useSpadesGameAdapter.ts` — Adapter
5. `packages/client/src/games/spades/useSpadesDirector.ts` — Director
6. `packages/client/src/games/spades/SpadesEngineBoard.vue` — UI

---

## Shared Utilities (USE THESE)

### Client-side multiplayer helpers:
```typescript
// Queue management during animations
import { createMultiplayerQueueController } from '@/stores/multiplayerQueue'

// Reactive state updates without flickering
import { updateIfChanged } from '@/stores/utils'

// Resync handling
import { createResyncController } from '@/stores/multiplayerResync'

// Debug snapshots
import { createMultiplayerDebugger } from '@/stores/multiplayerDebug'
```

### Shared types:
```typescript
import { 
  Suit, FullRank, Card,           // Core card types
  GameType, TableSettings,         // Lobby types
  type ServerMessage,              // Multiplayer messages
} from '@euchre/shared'
```

---

## Conventions

### Naming
- Game classes: `*Game.ts` (server)
- Stores: `*Store.ts` or `*MultiplayerStore.ts`
- Composables: `use*.ts`
- Components: `*GameBoard.vue`, `*EngineBoard.vue`

### State management
- Use `ref()` for primitives, `shallowRef()` for Maps
- Use `updateIfChanged()` to prevent unnecessary reactivity
- Use `triggerRef()` after mutating shallowRef

### Multiplayer flow
- All game state is server-authoritative
- Client sends actions with `expectedStateSeq`
- Server responds with `sync_required` if state diverged
- Queue animations to prevent flicker during state updates

---

## Common Tasks

### Add a feature to existing game:
1. Add types to `packages/shared/src/{game}/types.ts`
2. Add logic to `packages/server/src/{Game}.ts`
3. Update store/adapter if new state needed
4. Update board component for UI

### Fix a multiplayer bug:
1. Check `games/<game>/*MultiplayerStore.ts` for message handling
2. Check `sessions/handlers.ts` for server-side logic
3. Use browser DevTools Network tab → WS to see messages
4. Add debug logging via `multiplayerDebug.ts`

### Add a new game:
See `docs/NEW_GAME_GUIDE.md` for step-by-step instructions.

---

## Quick Commands

```bash
# Development
npm run dev              # Start client (port 4200)
npm run start:server     # Start server (port 3001)

# Build (in order)
npm run build:shared
npm run build:server
npm run build

# Test
npm test                 # Server unit tests
cd e2e && npm test       # E2E tests
```

---

## Documentation Map

| Doc | Purpose |
|-----|---------|
| `README.md` | Setup, commands |
| `docs/LLM_ONBOARDING.md` | This file - quick architecture overview |
| `docs/NEW_GAME_GUIDE.md` | Step-by-step new game implementation |
| `docs/ROADMAP.md` | Current status, checklists, deferred work |
| `docs/MULTIPLAYER_ARCHITECTURE.md` | Deep-dive architecture reference |
| `CLAUDE.md` | Session conventions (if using Claude) |
