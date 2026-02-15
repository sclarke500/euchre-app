# Multiplayer Game Implementation Roadmap

## Purpose

This document serves three functions:

1. **Implementation Guide** — Step-by-step checklist for adding multiplayer to new games
2. **Cross-Reference Matrix** — Quick comparison of what's implemented in each existing game (Euchre, Spades, President) to catch missing features
3. **Future Planning** — Documented backlog of enhancements, separated by priority

**How to use this document:**
- When adding a new game: Follow the Implementation Checklist section
- When debugging/auditing: Check the Cross-Reference Matrix for gaps
- Before each release: Scan for ⚠️ markers indicating missing implementations

---

## Implementation Checklist

### Phase 1: Server-Side Game Logic

| Step | Description | Euchre | Spades | President |
|------|-------------|:------:|:------:|:---------:|
| 1.1 | Create `XxxGame.ts` with game rules | ✅ | ✅ | ✅ |
| 1.2 | Implement `stateSeq` counter (increment on every state change) | ✅ | ✅ | ✅ |
| 1.3 | Implement `buildClientState(odusId)` — filtered state per player | ✅ | ✅ | ✅ |
| 1.4 | Implement `broadcastState()` — send to all human players | ✅ | ✅ | ✅ |
| 1.5 | Implement `onYourTurn` callback with valid actions/cards | ✅ | ✅ | ✅ |
| 1.6 | Add AI player logic | ✅ | ✅ | ✅ |
| 1.7 | Implement `replaceWithAI(playerIndex)` | ✅ | ✅ | ✅ |
| 1.8 | AI takes over immediately if it was their turn | ✅ | ✅ | ✅ |
| 1.9 | Implement `restoreHumanPlayer(seatIndex, odusId, name)` | ✅ | ✅ | ✅ |
| 1.10 | Implement turn timeout system (server-side timer) | ✅ | ✅ | ✅ |
| 1.11 | Implement `bootPlayer(playerIndex)` for timed-out players | ✅ | ✅ | ✅ |
| 1.12 | Add `timedOutPlayer` to client state for UI indicator | ✅ | ✅ | ✅ |

### Phase 2: Server-Side Routing

| Step | Description | Euchre | Spades | President |
|------|-------------|:------:|:------:|:---------:|
| 2.1 | Add message types to `ws/router.ts` | ✅ | ✅ | ✅ |
| 2.2 | Add handlers in `sessions/handlers.ts` | ✅ | ✅ | ✅ |
| 2.3 | Add game registry in `sessions/registry.ts` | ✅ | ✅ | ✅ |
| 2.4 | Add to `index.ts` disconnect handling (track for reconnection) | ✅ | ✅ | ✅ |
| 2.5 | Add to `index.ts` reconnection recovery (`tryRecoverGameId`) | ✅ | ✅ | ✅ |

### Phase 3: Shared Types

| Step | Description | Euchre | Spades | President |
|------|-------------|:------:|:------:|:---------:|
| 3.1 | Define client game state type | ✅ | ✅ | ✅ |
| 3.2 | Define server→client message types | ✅ | ✅ | ✅ |
| 3.3 | Define client→server message types | ✅ | ✅ | ✅ |
| 3.4 | Add to `GameType` union | ✅ | ✅ | ✅ |

### Phase 4: Client-Side Store

| Step | Description | Euchre | Spades | President |
|------|-------------|:------:|:------:|:---------:|
| 4.1 | Create `xxxMultiplayerStore.ts` | ✅ | ✅ | ✅ |
| 4.2 | WebSocket message subscription | ✅ | ✅ | ✅ |
| 4.3 | Use `updateIfChanged()` for reactive state (prevents flickering) | ✅ | ✅ | ✅ |
| 4.4 | Implement `messageQueue` + `queueMode` for animation sync | ✅ | ✅ | ✅ |
| 4.5 | Track `lastStateSeq` for ordering | ✅ | ✅ | ✅ |
| 4.6 | Handle `game_lost` error code | ✅ | ✅ | ✅ |
| 4.7 | Implement `cleanup()` function (clear subscriptions, reset state) | ✅ | ✅ | ✅ |
| 4.8 | Implement `requestStateResync()` | ✅ | ✅ | ✅ |

### Phase 5: Client-Side Adapter (optional but recommended)

| Step | Description | Euchre | Spades | President |
|------|-------------|:------:|:------:|:---------:|
| 5.1 | Create `useXxxGameAdapter.ts` — unified interface for single/multi | ✅ | ⚠️ **NO** | ✅ |
| 5.2 | Abstract store differences (local engine vs WebSocket) | ✅ | ⚠️ **NO** | ✅ |
| 5.3 | Cache computed transformations to prevent re-renders | ✅ | ⚠️ **NO** | ✅ |

### Phase 6: Client-Side Director (optional but recommended)

| Step | Description | Euchre | Spades | President |
|------|-------------|:------:|:------:|:---------:|
| 6.1 | Create `useXxxDirector.ts` — animation orchestration | ✅ | ⚠️ **NO** | ✅ |
| 6.2 | Seat rotation (human always at bottom) | ✅ | ✅* | ✅ |
| 6.3 | Watch state changes and trigger animations | ✅ | ✅* | ✅ |
| 6.4 | Manage queue mode during animations | ✅ | ⚠️ **NO** | ✅ |

*Spades has this logic in the GameBoard component directly

### Phase 7: Client-Side UI

| Step | Description | Euchre | Spades | President |
|------|-------------|:------:|:------:|:---------:|
| 7.1 | Create `XxxGameBoard.vue` | ✅ | ✅ | ✅ |
| 7.2 | Integrate with `CardTable` component | ✅ | ✅ | ✅ |
| 7.3 | Add `GameHUD` (back button, bug report, resync) | ✅ | ✅ | ✅ |
| 7.4 | Add `TurnTimer` component for visual countdown | ✅ | ⚠️ **NO** | ✅ |
| 7.5 | Handle `gameLost` → show message and exit | ✅ | ✅ | ✅ |
| 7.6 | Add game-specific UI (scoreboard, action buttons) | ✅ | ✅ | ✅ |
| 7.7 | Call `initialize()` on mount (multiplayer) | ✅ | ✅ | ✅ |
| 7.8 | Call `cleanup()` on unmount | ✅ | ✅ | ✅ |

### Phase 8: Lobby Integration

| Step | Description | Euchre | Spades | President |
|------|-------------|:------:|:------:|:---------:|
| 8.1 | Add to game type selector in lobby | ✅ | ✅ | ✅ |
| 8.2 | Handle table creation for game type | ✅ | ✅ | ✅ |
| 8.3 | Handle game start from lobby | ✅ | ✅ | ✅ |

### Phase 9: Testing

| Step | Description | Euchre | Spades | President |
|------|-------------|:------:|:------:|:---------:|
| 9.1 | Single-player game completes | ✅ | ✅ | ✅ |
| 9.2 | Multiplayer connects and receives state | ✅ | ✅ | ✅ |
| 9.3 | Turns work correctly | ✅ | ✅ | ✅ |
| 9.4 | Disconnect → AI takeover works | ✅ | ✅ | ✅ |
| 9.5 | Reconnect → restore seat works | ✅ | ✅ | ✅ |
| 9.6 | Animations don't cause flickering | ✅ | ⚠️ ? | ✅ |
| 9.7 | Bug report captures game state | ✅ | ✅ | ✅ |

---

## Gap Analysis Summary

### Spades Missing Items

| Priority | Item | Effort |
|----------|------|--------|
| Medium | Game adapter (`useSpadesGameAdapter.ts`) | ~2 hours |
| Medium | Director (`useSpadesDirector.ts`) | ~3 hours |
| Medium | TurnTimer UI component | ~30 min |
| Low | Animation queue mode in UI | ~1 hour |

**Note:** Spades works without these — the logic is in the GameBoard component. The adapter/director pattern is cleaner but not required. TurnTimer is user-facing polish.

### President Missing Items

None identified. President has full implementation.

### Euchre Missing Items

None identified. Euchre has full implementation.

---

## Active Issues

| Issue | Game | Description | Status |
|-------|------|-------------|--------|
| Multiplayer state not loading | President | WebSocket messages may not be arriving | Investigating |
| Dimmed cards flickering | President | `validPlays` updates trigger unnecessary reactivity | Investigating |

---

## In Progress Features

| Feature | Description | Status |
|---------|-------------|--------|
| Klondike hint functionality | Show next valid move | Not started |
| Spades multiplayer routing | Enable WebSocket routing in handlers.ts | Not started |

---

## For Future Consideration

### UX Polish

| Feature | Description | Priority |
|---------|-------------|----------|
| Emotes / quick chat | Preset reactions during games | Medium |
| Game statistics | Win/loss tracking per game type | Medium |
| Sound effects | Card play, win/loss audio | Low |
| Themes | Different felt colors, card backs | Low |
| Daily challenges | Engagement hooks | Low |

### Code Quality

From CODE_REVIEW.md:

| Issue | Description | Priority |
|-------|-------------|----------|
| President GameBoard monolith | 979 lines, should match Euchre's component structure | Medium |
| "Unified" naming is misleading | Rename to Euchre* or actually unify | Low |
| Back button inconsistency | Different styles per game | Low |
| Card overlap values | Define standard values in SCSS variables | Low |

### Infrastructure (Skip Until Scale Requires)

| Feature | Description | Trigger |
|---------|-------------|---------|
| Redis session persistence | Game state survives server restarts | Paid hosting tier |
| Redis pub/sub | Multi-instance server support | Load balancer needed |
| Sticky sessions | WebSocket affinity in load balancer | Multiple servers |
| Database game history | Store completed games | User requests |
| Room cleanup (memory) | Clean abandoned games periodically | Paid hosting tier |
| Spectator mode | Watch games without playing | Tournament feature |
| Ranked matchmaking | ELO/skill-based pairing | Active user base |

---

## Document Maintenance

**Last updated:** 2026-02-15

**Update this document when:**
- Adding a new multiplayer game
- Implementing a missing feature
- Discovering a gap between games
- Moving items between sections

**Review cadence:** Before each major release
