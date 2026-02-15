# Implementation Plan: Multiplayer Flow Alignment

**Date:** 2026-02-15  
**Companion roadmap:** `docs/ROADMAP.md`

## Objective

Implement the roadmap in phased, low-risk increments while keeping all three games playable and stable.

## Working Rules

- Keep protocol compatibility in Phases 1-3.
- Keep game rules untouched unless a bug fix is explicitly required.
- Ship each phase behind small, testable commits.
- Verify all three games after each phase checkpoint.

---

## Phase 0 — Diagnostics + Baseline

**Estimated effort:** 1-2 days

## Tasks

1. Add shared multiplayer debug utility on client
   - Create helper for normalized debug snapshots (queue length, state seq, phase, turn ownership).
   - Integrate into:
     - `packages/client/src/stores/multiplayerGameStore.ts`
     - `packages/client/src/stores/presidentMultiplayerStore.ts`
     - `packages/client/src/stores/spadesMultiplayerStore.ts`

2. Add structured server-side orchestration logs
   - Include: gameId, gameType, message/action type, stateSeq, playerId.
   - Touch:
     - `packages/server/src/index.ts`
     - `packages/server/src/sessions/handlers.ts`

3. Baseline reliability capture
   - Measure current behavior for:
     - reconnect success
     - `sync_required` recovery
     - boot/timed-out flow completion

## Validation

- Run targeted multiplayer E2E scenarios for each game.
- Save baseline observations in `docs/ROADMAP.md` notes section (or follow-up issue).

## Exit gate

- Multiplayer incidents are diagnosable from logs without ad-hoc console edits.

## Baseline Run (2026-02-15)

- Command used:
   - `cd e2e && BASE_URL=http://localhost:4200 npx playwright test tests/spades-multiplayer.spec.ts tests/turn-timer.spec.ts --workers=1 --reporter=line`
- Result:
   - `3 passed (27.3s)`
- Notes:
   - Full-suite runs can appear stuck when local app/server are not both running.
   - `playwright.config.ts` defaults to live site unless `BASE_URL` is overridden.
   - Use `npm run test:phase0` from `e2e/` for a bounded local baseline check.

## Local E2E Quickstart

Use this flow for reliable local multiplayer checks:

1. Start backend (port `3001`):
   - `cd /Users/steve/code/euchre-app && npm run start:server`
2. Start frontend (port `4200`):
   - `cd /Users/steve/code/euchre-app && npm run dev`
3. Run bounded baseline suite:
   - `cd /Users/steve/code/euchre-app/e2e && npm run test:phase0`

Optional headed run:

- `cd /Users/steve/code/euchre-app/e2e && npm run test:phase0:headed`

Preflight behavior:

- `test:phase0` now runs `pretest:phase0` first.
- Preflight validates client (`BASE_URL`, default `http://localhost:4200`) and server health (`http://localhost:3001/health`).
- If either endpoint is unavailable, tests fail fast with explicit startup guidance.

---

## Phase 1 — Server Runtime Unification

**Estimated effort:** 3-5 days

## Tasks

1. Introduce server runtime interface
   - Create server-local type (not shared package), for example:
     - `packages/server/src/sessions/runtime.ts`
   - Include contract for init/start/state/resync/ai replace/restore/dispatch.

2. Create runtime adapters for existing game classes
   - Wrap:
     - `Game`
     - `PresidentGame`
     - `SpadesGame`
   - Preserve existing event wiring and payload shapes.

3. Replace split registry with unified runtime registry
   - Refactor `packages/server/src/sessions/registry.ts`.
   - Keep compatibility helpers temporarily if needed during migration.

4. Refactor orchestration paths to runtime contract
   - `start_game`, `restart_game`, `request_state`
   - disconnect/leave-game handling
   - primary files:
     - `packages/server/src/sessions/handlers.ts`
     - `packages/server/src/index.ts`

5. Keep action routing stable
   - Route command handling through runtime dispatch layer while preserving existing message types.

## Validation

- Build and run server/shared builds.
- Execute multiplayer start/restart/disconnect/reconnect flows for all three games.
- Confirm no wire format changes required on client.

## Exit gate

- One orchestration path for runtime lifecycle across game types.

---

## Phase 2 — Spades Client Parity

**Estimated effort:** 2-4 days

## Tasks

1. Add adapter
   - Create `packages/client/src/composables/useSpadesGameAdapter.ts`.
   - Match conventions used in Euchre/President adapters.

2. Add director
   - Create `packages/client/src/composables/useSpadesDirector.ts`.
   - Move animation queue, trick progression choreography, and seat mapping here.

3. Slim board orchestration
   - Refactor `packages/client/src/components/spades/SpadesGameBoard.vue` to view + user interactions.

4. Add timer parity
   - Integrate `TurnTimer` and timeout affordances consistent with Euchre/President behavior.

## Validation

- Spades single-player and multiplayer both run with no regressions.
- Queue-mode animation sync remains correct.
- Timeout behavior is visible and consistent.

## Exit gate

- Spades follows `store -> adapter -> director -> board` architecture.

## Phase 2 Closeout (2026-02-15)

**Status:** Completed

### Delivered

- Added `useSpadesGameAdapter.ts` with single-player and multiplayer adapter parity.
- Added `useSpadesDirector.ts` for queue/animation lifecycle orchestration.
- Added `useSpadesBoardUi.ts` for board-facing UI/state formatting.
- Refactored `SpadesGameBoard.vue` to consume adapter/director/UI composables.
- Added `TurnTimer` timeout handling + timed-out player affordance parity.

### Validation Evidence

- `npm run build:shared` -> pass
- `npm run build:server` -> pass
- `cd e2e && npm run test:phase0` -> pass (bounded multiplayer baseline suite)

### Notes

- Local bounded E2E is stable when frontend (`:4200`) and backend (`:3001`) are up.
- Preflight checks now fail fast with startup guidance when dependencies are unavailable.

## Phase 3 Entry Checklist

- [x] Runtime-first server orchestration is in place (Phase 1 complete).
- [x] Spades client architecture parity is complete (Phase 2 complete).
- [x] Baseline diagnostics and bounded E2E preflight flow are available.
- [x] Select initial shared store extraction slice (`queue mode + drain` recommended first).
- [x] Capture before/after duplication and behavior parity notes during extraction.

---

## Phase 3 — Multiplayer Store Harmonization

**Estimated effort:** 2-3 days

## Tasks

1. Extract shared store utilities/composables
   - queue mode management
   - sequence bookkeeping
   - common error code handling (`sync_required`, `game_lost`)
   - reconnect-triggered resync pattern

2. Refactor stores to consume shared utilities
   - `multiplayerGameStore.ts`
   - `presidentMultiplayerStore.ts`
   - `spadesMultiplayerStore.ts`

3. Preserve game-specific message application logic
   - Keep per-game event/data handling local.

## Validation

- Compare behavior before/after with same E2E suite.
- Ensure no stale-turn regressions.

## Exit gate

- Meaningful duplication reduction with unchanged user-visible behavior.

## Phase 3 Progress Update (2026-02-15)

**Status:** Completed

### Delivered

- Added shared queue utility (`multiplayerQueue.ts`) and migrated all three multiplayer stores.
- Added shared sync/error utility (`multiplayerSync.ts`) for state-sequence and common `sync_required`/`game_lost` handling.
- Added shared stale-state/reconnect watchdog (`multiplayerResync.ts`) with unified resync cadence/thresholds.
- Kept game-specific message application logic local to each store.

### Duplication/Parity Outcome

- Queue control semantics are now consistent across Euchre/President/Spades stores.
- `expectedStateSeq` derivation is now consistently `max(snapshotSeq, lastStateSeq)` across stores.
- Reconnect/stale-state resync behavior is now aligned across stores (including initialize-time baseline resync).

### Validation Evidence

- `npm run build:client` -> pass
- `cd e2e && npm run test:phase0` -> pass (`3 passed`)
- `cd e2e && BASE_URL=http://localhost:4200 npx playwright test tests/smoke.spec.ts tests/spades-multiplayer.spec.ts tests/turn-timer.spec.ts tests/spades.spec.ts --workers=1 --reporter=line` -> pass (`13 passed`, `3 skipped`)
- `npm run build:shared && npm run build:server && npm run build:client` -> pass

### Remaining to Phase 3 Closeout

- Optional: capture quantitative duplication delta metrics in a follow-up note.

---

## Phase 4 — Protocol Consolidation (Optional)

**Estimated effort:** 3-5 days

## Tasks

1. Evaluate whether conservative path is sufficient.
2. If moving forward, design compatibility migration strategy for message envelopes.
3. Implement only after one stable cycle from Phases 1-3.

## Exit gate

- Clear benefit demonstrated over complexity and migration risk.

---

## Cross-Phase Test Matrix

Run after each phase:

1. Create table -> join seats -> start game
2. First turn command success
3. Mid-game refresh/reconnect restoration
4. Forced state mismatch and resync recovery
5. Timed-out player replacement and continuation
6. Host restart and new game session continuity

Games covered each run:
- Euchre
- President
- Spades

---

## Suggested Execution Order (Week View)

- **Week 1:** Phase 0 + Phase 1 scaffolding
- **Week 2:** Phase 1 completion + hardening
- **Week 3:** Phase 2 Spades parity
- **Week 4:** Phase 3 harmonization + stabilization
- **Later:** Optional Phase 4 decision

---

## Rollback Strategy

For each phase:

- Keep migration commits scoped by subsystem.
- Preserve temporary compatibility adapters until phase exit gate passes.
- If regressions appear, roll back to previous phase tag and re-apply incrementally.

---

## Definition of Done (Program Level)

- Same multiplayer lifecycle semantics across all three games.
- Server orchestration is runtime-driven, not game-branch driven.
- Spades has adapter/director parity.
- Shared store behavior is centralized where safe.
- E2E multiplayer reliability is stable across reconnect, resync, and restart flows.
