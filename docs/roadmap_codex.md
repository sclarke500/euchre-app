# Multiplayer Flow Alignment Roadmap (Codex)

**Date:** 2026-02-15  
**Scope:** Euchre, President, Spades multiplayer lifecycle alignment across client + server

## Executive Summary

The repo already has a strong baseline: server-authoritative state, per-game command serialization, reconnect recovery, state sequence drift detection, and AI substitution on disconnect. The biggest reliability risk now is **flow divergence** between games rather than missing core multiplayer primitives.

The cleanest path is **not** a rewrite. It is a phased convergence to one multiplayer lifecycle contract and one implementation skeleton with game-specific plug-ins.

---

## What the Code Actually Shows (Current Reality)

## 1) Good shared foundations already in place

- Server command ordering per game via `enqueueGameCommand(gameId, ...)`.
- Optimistic drift protection using `expectedStateSeq` and server-side `sync_required`.
- Reconnect + restore across all three games (`replaceWithAI`, `restoreHumanPlayer`, `resendStateToPlayer`).
- Client-side queue buffering during animations in all three multiplayer stores.

## 2) Main divergence points causing predictability gaps

### Server
- `packages/server/src/sessions/handlers.ts` duplicates game creation/start/restart plumbing for each game type.
- `packages/server/src/index.ts` contains game-type branching in action handlers (bid/play/boot/etc).
- `packages/server/src/sessions/registry.ts` stores three parallel maps (`games`, `presidentGames`, `spadesGames`) plus `gameTypes` instead of one typed runtime registry.

### Client
- Euchre + President use adapter/director + engine board pattern.
- Spades multiplayer is still board-centric and store-direct (no dedicated adapter/director parity).
- Multiplayer stores are similar but not standardized (different stale-turn guards, resync heuristics, timeout UI integration).

### UX consistency
- Turn timer UX exists in Euchre + President engine boards; Spades multiplayer lacks equivalent timer behavior.
- Timed-out player handling is server-complete but not surfaced with consistent in-game affordances across all three boards.

---

## Corrections to Current Roadmap Assumptions

The existing roadmap is directionally good, but parts are stale vs current code:

- “Spades multiplayer routing not started” is outdated: server has `spades_make_bid`, `spades_game_state`, `spades_your_turn`, and routing/handlers implemented.
- “President multiplayer state not loading” should be treated as intermittent/runtime issue, not missing architecture.
- “Spades missing adapter/director is optional” underestimates maintenance cost; this is now the largest structural inconsistency.

---

## Target: One Canonical Multiplayer Flow

## Canonical lifecycle (all games)

1. `join_lobby` + identity restore
2. `create_table` / `join_table`
3. `start_game` -> server creates game runtime via factory
4. `game_started`
5. Continuous loop:
   - server emits filtered state snapshot
   - server emits turn prompt for acting player
   - client sends command with `expectedStateSeq`
   - server validates, mutates, broadcasts next state
6. On disconnect:
   - seat replaced by AI
   - reconnect grace tracking
   - restore human seat if rejoin occurs in window
7. End round/game:
   - state-driven completion + optional events
8. `restart_game` via same factory path and same runtime contract

## Canonical contract layers

### Server runtime contract
Create a single interface used by Euchre/President/Spades wrappers:

- `initializePlayers(...)`
- `start()`
- `resendStateToPlayer(odusId)`
- `findPlayerIndexByOdusId(odusId)`
- `replaceWithAI(playerIndex)`
- `restoreHumanPlayer(seatIndex, odusId, nickname)`
- `bootPlayer(playerIndex)`
- `getPlayerInfo(odusId)`
- `getStateSeq()`
- `dispatch(actionMessage, odusId)` (unified action entrypoint)

### Client multiplayer contract
Standardize all game multiplayer stores around:

- shared transport lifecycle (`initialize`, `cleanup`, `requestStateResync`)
- shared queue semantics (`enableQueueMode`, `dequeueMessage`, `disableQueueMode`)
- shared turn state shape (`isMyTurn`, `validActions`, `validPlays/validCards`, `timedOutPlayer`)
- shared stale-message guards + sync_required handling
- shared expectedStateSeq helper

Then enforce adapter/director/board layering for all games:

- `store` = socket + raw server state
- `adapter` = unified UI-friendly API
- `director` = animation orchestration
- `board` = rendering + user interactions only

---

## Gap Matrix (High Signal)

| Area | Euchre | President | Spades | Priority |
|---|---|---|---|---|
| Server runtime contract abstraction | Partial | Partial | Partial | P0 |
| Single runtime registry | No | No | No | P0 |
| Adapter layer parity | Yes | Yes | **No** | P0 |
| Director layer parity | Yes | Yes | **No** | P0 |
| Turn timer UX parity | Yes | Yes | **No** | P1 |
| Timeout/boot UX parity | Partial | Partial | **Low** | P1 |
| Restart/start flow duplication removal | No | No | No | P1 |
| Store-level stale-message policy parity | Medium | Medium | Medium | P2 |

---

## Implementation Plan (Phased, Low-Risk)

## Phase 0 — Stabilize and instrument (1-2 days)

- Add structured multiplayer logs (message type, seq, queue length, gameId, gameType).
- Add a shared debug helper for all multiplayer stores.
- Add health assertions around queue drain and stale-turn protection.

**Exit criteria**
- Repro diagnostics are consistent across all games.

## Phase 1 — Server unification shell (2-4 days)

- Introduce `GameRuntime` interface + adapter wrappers for existing game classes (no game logic rewrite).
- Introduce one runtime registry map: `Map<gameId, { type, runtime, hostId, settings }>`.
- Refactor start/restart/resync/disconnect flows to use runtime interface instead of per-game branches where possible.
- Keep message payload formats unchanged in this phase (avoid client breakage).

**Exit criteria**
- `start_game`, `restart_game`, `request_state`, disconnect/restore use one orchestration path.

## Phase 2 — Spades client parity (2-4 days)

- Add `useSpadesGameAdapter.ts` following Euchre/President adapter shape.
- Add `useSpadesDirector.ts` to own animation queue and seat mapping.
- Slim `SpadesGameBoard.vue` to board responsibilities only.
- Add TurnTimer + timeout affordances equivalent to Euchre/President.

**Exit criteria**
- Spades flow structure matches Euchre/President (`store -> adapter -> director -> board`).

## Phase 3 — Shared multiplayer base utilities (2-3 days)

   - queue control
n  - seq tracking
  - sync_required + game_lost handling
  - reconnect resync hook
- Keep game-specific message mapping in thin adapters.

**Exit criteria**
- Multiplayer store duplication reduced without changing protocol behavior.

## Phase 4 — Protocol harmonization (optional, 2-5 days)

- Option A (safer): keep existing message names, standardize internal handling only.
- Option B (cleaner long-term): unify to generic envelope (`game_state`, `game_event`, `turn_prompt`) with `gameType` + payload.

**Recommendation:** Option A now, Option B only after parity + test stabilization.

**Exit criteria**
- No behavior regressions and simpler onboarding for new multiplayer games.

---

## Test Strategy Required for Each Phase

## E2E critical paths (all 3 games)

- Create table -> start game -> first playable turn
- Mid-game disconnect -> AI replacement -> reconnect restore
- Expected state mismatch -> `sync_required` -> successful resync
- Timed-out player flow -> boot -> continued progression
- Host restart flow preserves seat mapping and game type

## Non-functional checks

- Queue mode never stalls UI turn progression
- No stale `your_turn` activation after state updates
- No duplicate command effects under reconnect/retry

---

## Proposed File-Level Refactor Targets

### Server
- `packages/server/src/sessions/registry.ts`: replace parallel maps with one runtime registry.
- `packages/server/src/sessions/handlers.ts`: extract game-runtime factory + shared start/restart logic.
- `packages/server/src/index.ts`: route gameplay commands via runtime dispatch.

### Client
- `packages/client/src/components/spades/SpadesGameBoard.vue`: reduce orchestration logic.
- `packages/client/src/composables/`: add `useSpadesGameAdapter.ts`, `useSpadesDirector.ts`.
- `packages/client/src/stores/`: extract shared multiplayer store helpers consumed by all three multiplayer stores.

---

## Industry Alignment (From Common Multiplayer Practice)

This roadmap aligns with proven multiplayer reliability patterns:

- server-authoritative snapshots
- idempotent/sequence-checked commands
- explicit resync path
- deterministic per-room command serialization
- reconnect grace + AI substitution fallback

The remaining reliability gains now come mostly from **architecture convergence**, not new protocol features.

---

## Recommended Next Moves (Order)

1. Server runtime abstraction + single registry (highest leverage for bug surface reduction).
2. Spades adapter/director parity (highest leverage for client predictability).
3. Unified store helper extraction.
4. Optional protocol envelope unification after stabilization.

---

## Notes

This plan deliberately favors incremental, reversible changes. It avoids rewriting game rule engines and focuses on eliminating divergence in multiplayer orchestration paths, where most cross-game bugs are currently introduced.
