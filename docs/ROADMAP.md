# Multiplayer Shared Flow Roadmap

**Last updated:** 2026-02-16  
**Scope:** Shared multiplayer architecture for Euchre, President, Spades, and future multiplayer games.

## Purpose

This is the single source of truth for current multiplayer architecture, lifecycle, and implementation guidance in this repo.

If another document conflicts with this one, this document takes precedence.

Use this doc to:

1. Understand the current shared multiplayer lifecycle.
2. Add a new multiplayer game using established patterns.
3. Track scale-oriented TODOs that are intentionally deferred.

---

## Current Status

### Implemented baseline (current standard)
- Server runtime-first orchestration via shared runtime registry.
- Canonical client layering: `store -> adapter -> director -> board`.
- Shared store utilities for queueing, sync/error handling, and stale-state resync.
- Reconnect + AI replacement + seat restore behavior implemented across games.
- `expectedStateSeq` / `sync_required` protection path in place.

### Current multiplayer games in scope
- Euchre
- President
- Spades

### Non-goals for routine feature work
- Rewriting game rules to match architecture.
- Renaming wire protocol messages without a migration plan.
- Introducing large platform infra before scale triggers are met.

---

## Canonical Shared Multiplayer Lifecycle

All multiplayer games should implement this lifecycle:

1. **Lobby entry**
   - `join_lobby` with identity restore (`odusId` reuse).
2. **Table setup**
   - `create_table` / `join_table`.
3. **Game start**
   - `start_game` routes through runtime factory/registry.
4. **Authoritative loop**
   - server emits filtered game state,
   - server emits turn prompt,
   - client sends command with `expectedStateSeq`,
   - server validates and emits next state.
5. **Disconnect behavior**
   - human seat replaced with AI,
   - reconnect grace window,
   - seat restored if player returns in time.
6. **Completion + restart**
   - round/game completion from server-authoritative state,
   - `restart_game` uses the same runtime orchestration path.

---

## Shared Contracts (Reference)

### Server contract
- Runtime entry per game in unified registry:
  - `Map<gameId, { type, runtime, hostId, settings }>`
- Runtime must support:
  - init/start
  - resend state to a player
  - find/replace/restore/boot player
  - player info lookup
  - state sequence query

### Client contract
- Store responsibilities:
  - websocket lifecycle
  - server state ingestion
  - turn state
  - queue integration
  - resync/error handling
  - game-local implementation under `packages/client/src/games/<game>/`.
- Adapter responsibilities:
  - normalize singleplayer/multiplayer data shape for board/director.
  - game-local implementation under `packages/client/src/games/<game>/`.
- Director responsibilities:
  - animation orchestration
  - queue drain coordination
  - seat mapping + board timing.
  - game-local implementation under `packages/client/src/games/<game>/`.
- Board responsibilities:
  - rendering + user interactions only.
  - game-local implementation under `packages/client/src/games/<game>/`.

Shared multiplayer helpers should remain in `packages/client/src/stores/` (e.g., queue/resync/sync/debug utilities).

---

## New Multiplayer Game Onboarding Checklist

Use this checklist when adding a new multiplayer game.

### 1) Shared types/protocol
- Add game-specific client/server message types in `packages/shared`.
- Add filtered client state type and turn prompt payload.

### 2) Server runtime wiring
- Implement runtime-compatible game class methods.
- Register runtime in session start/restart paths.
- Ensure reconnect/restore/boot uses runtime path only.

### 3) Client architecture
- Create store with shared queue/sync/resync utilities.
- Create adapter (`singleplayer` + `multiplayer` parity).
- Create director for animation + queue coordination.
- Keep board focused on display + interaction.
- Place game-local files in `packages/client/src/games/<game>/` and keep cross-game utilities in shared top-level folders.

### 4) UX parity requirements
- Turn/timer affordance parity.
- Timed-out player affordance parity.
- Game-lost/resync behavior parity.

### 5) Validation gate (must pass)
- Table create/join/start to first actionable turn.
- Mid-game disconnect -> AI replace -> reconnect -> restore.
- Forced state mismatch -> `sync_required` -> successful resync.
- Timed-out player flow continues game correctly.
- Restart flow preserves seat mapping and game type.

---

## Scale TODO Backlog (Deferred Until Needed)

These are intentionally deferred until usage/load justifies complexity.

### P1 — Near-term hardening
- [ ] Add cross-game parity E2E matrix for reconnect/resync/restart.
- [ ] Capture and track reliability metrics (session completion, restore success).
- [ ] Standardize timeout affordance language/UI across all boards.

### P2 — Protocol/operability improvements
- [ ] Decide on protocol consolidation strategy (keep current vs envelope model).
- [ ] Add idempotency/duplicate-command observability dashboards.
- [ ] Add structured server log sink for orchestration events.

### P3 — Infrastructure scaling triggers
- [ ] Define threshold for external state store (e.g., Redis) adoption.
- [ ] Define threshold for multi-instance websocket deployment.
- [ ] Add runbook for sticky sessions + reconnect semantics under load balancer.

---

## Maintenance Rule

When multiplayer architecture changes, update in this order:

1. `docs/ROADMAP.md` (this file)
2. `docs/DOCUMENTATION_INDEX.md`
3. `README.md` (if setup/run flow changed)
