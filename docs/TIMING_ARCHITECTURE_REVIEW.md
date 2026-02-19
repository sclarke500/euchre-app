# Timing & Pause Architecture — Code Validation Review

Date: 2026-02-19  
Source reviewed: `docs/TIMING_ARCHITECTURE.md`

## Scope and method

I reviewed the timing architecture doc, then verified the current implementation across:

- Server game loops:
  - `packages/server/src/games/euchre/EuchreGame.ts`
  - `packages/server/src/games/spades/SpadesGame.ts`
  - `packages/server/src/games/president/PresidentGame.ts`
  - `packages/server/src/games/president/cardExchange.ts`
- Client SP/MP game flows:
  - `packages/client/src/games/*/*Store.ts`
  - `packages/client/src/games/*/use*Director.ts`
  - `packages/client/src/utils/animationTimings.ts`
  - queue/resync utilities under `packages/client/src/stores/`

This document validates/challenges findings in the source doc and proposes improvements to align timing/pausing for resiliency and predictability.

---

## Validation summary

## ✅ Confirmed

1. **Timing is spread across layers** (server, stores, directors, view-level UI helpers).
2. **Mixed ownership exists** (logic timing and animation timing are interleaved in places).
3. **Magic numbers are common** (many direct `setTimeout(...)` and inline `sleep(...)`).
4. **SP vs MP timing behavior diverges** in all trick-taking games.

## ⚠️ Partially correct / outdated

1. **Some timing inventory values in the source doc are stale**:
   - Server Euchre currently uses delays such as `500ms`, `1500ms`, and `800ms` in key flow points, not the older `600/1200/500` set.
   - Server Spades currently uses `1500ms` deal-to-bid transition and `800ms` AI turn delay.
2. **The source doc misses critical timing systems**:
   - Server turn reminder and timeout chain (`TURN_REMINDER_DELAY=15000`, timeout after 4 reminders) exists in Euchre, Spades, and President.
   - Client resync watchdog timing (`checkInterval`, waiting/idle stale thresholds) affects pause perception and resilience.
3. **“Client buffers/queues messages” is already implemented** for Euchre/President/Spades MP stores; architecture is partly in place already.

## ❗ Challenged assumptions

1. **“Server should send state changes immediately” is a good target, but not drop-in safe today.**
   - Current server progression sometimes depends on delayed transitions (`TrickComplete -> Playing`, `RoundComplete -> Dealing`, exchange transitions).
   - If these are removed without a stronger client-side phase transition contract, players can see abrupt/ambiguous state jumps.
2. **A single queue strategy is not currently used across games.**
   - Euchre/President directors process queued messages in explicit async loops.
   - Spades director enables queue during deal, then disables (which flushes queue immediately), and animates via state-delta watchers.

---

## Current architecture observations (what matters most)

## 1) Ownership is inconsistent by game and mode

- **Server (MP):** controls AI delays, trick/round transition pauses, exchange pacing, and turn reminders.
- **Client directors (mostly MP):** control animation sequencing and extra visibility pauses.
- **Client SP stores:** still own several gameplay pacing pauses (`AI turn`, `round pause`, `exchange pause`) directly.

Result: a given concept (e.g., “time to read trick result”) is often controlled in different layers by game/mode.

## 2) Timing constants are centralized only partially

- `animationTimings.ts` exists and is used in some directors (especially Euchre).
- Many game-critical delays remain as inline literals in stores/directors/server.
- Different games define equivalent pauses with different values and locations.

## 3) Multiplayer buffering exists but is not standardized

- Queue controller pattern is shared (`createMultiplayerQueueController`).
- Processing models differ (manual queue loop vs watcher+delta).
- Queue `disable()` flushes buffered messages immediately, which may bypass intended pacing semantics unless each consumer compensates.

## 4) Timer lifecycle/cancellation is a resilience risk

- Long-lived `setTimeout` chains are common.
- Turn reminder timers are explicitly cleared; many AI/phase timers are not uniformly cancellable.
- This raises risk of stale callbacks after phase changes, reconnects, boot/replace, or rapid transitions.

---

## Recommended target model

## Timing ownership contract

1. **Server owns only gameplay fairness timing**
   - Turn reminders/timeouts
   - Optional AI think delay (authoritative in MP)
   - Anti-spam/cooldown constraints if needed

2. **Client owns presentation timing**
   - Animation durations
   - Post-animation readability pauses
   - UI status indicator visibility windows

3. **State progression model**
   - Server emits authoritative state/events as soon as game logic advances.
   - Client directors serialize visual application of those events.
   - If visual completion matters to interaction, client gates local affordances (not server logic).

This aligns with the original doc’s intent, but needs explicit infrastructure before removing server pauses.

---

## Concrete improvements (prioritized)

## P0 — Stabilize and de-risk (no behavior change)

1. **Create canonical timing registries** (client + server), replacing inline literals:
   - `serverTiming.ts` (turn reminders, AI think delay, optional logic pacing)
   - `animationTimings.ts` expanded (all director/store UI pauses)
2. **Tag each timing with purpose and owner**
   - Example metadata: `owner: 'server-logic' | 'client-visual' | 'client-ui-feedback'`.
3. **Audit and annotate every timer path** in Euchre/Spades/President to remove ambiguity.

## P1 — Unify client-side sequencing

1. **Standardize MP queue processing strategy across games**
   - Pick one model:
     - A) explicit async dequeue loop (Euchre/President style), or
     - B) state-delta animation engine (Spades style).
   - Avoid mixed semantics per game.
2. **Introduce a shared `TimingCoordinator` utility in client**
   - Capabilities: `sleep(key)`, `schedule(key, fn)`, cancellation scopes, debug traces.
3. **Move remaining SP pacing sleeps out of stores** into directors/callback orchestration where possible.

## P2 — Reduce server visual pacing (carefully)

1. **Start with President exchange server delays**
   - These are the clearest duplication points with client exchange animation pauses.
2. **Retain only logic-essential server delays**
   - AI think delay and turn reminders/timeouts.
3. **Add guardrails before removing each server pause**
   - Verify equivalent client sequencing exists in both SP and MP paths.

## P3 — Cancellable timers and observability

1. **Use cancellable timer handles for AI and phase timers on server** (not just reminder timers).
2. **Cancel on phase/game lifecycle boundaries**
   - round reset, player replacement, boot, game over, teardown.
3. **Add lightweight timing telemetry logs**
   - event type, scheduled delay, actual elapsed, canceled/executed.

---

## Suggested canonical timing vocabulary

Use semantic keys, not per-file literals:

- `logic.aiThink`
- `logic.turnReminderInterval`
- `logic.turnTimeoutReminderCount`
- `visual.cardPlay`
- `visual.trickSweep`
- `visual.exchange`
- `visual.phaseTransitionShort`
- `visual.phaseTransitionLong`
- `ui.statusBadge`
- `ui.highlight`

Then each game can map to defaults with optional overrides, but all references stay semantic.

---

## Migration plan (safe sequence)

1. **Inventory lock-in pass**
   - Replace literals with constants; no runtime behavior changes.
2. **Client sequencing convergence**
   - Choose one MP queue application model and apply to all three games.
3. **SP store cleanup**
   - Shift presentation sleeps to directors/callback gates.
4. **Server delay removal pass**
   - Remove only delays with verified client equivalents.
5. **Timer cancellation + telemetry**
   - Add cancellation scopes and debug counters.

---

## Optional product-level enhancements (after core alignment)

1. **Animation speed setting** (`Slow | Normal | Fast`) as a multiplier on visual timing keys.
2. **Skip/accelerate transitions** for power users (client-only; server remains authoritative).
3. **“Deterministic fast mode” for testing** where visual pauses collapse to near-zero but sequence ordering remains identical.

---

## Bottom line

The source doc is directionally strong, and the codebase already has key foundations (queue mode, director orchestration, timing constants file). The main gaps are **consistency of ownership**, **stale/inline timers**, and **lack of cancellable/observable timing infrastructure**.  

Best next step: do a **no-behavior-change timing centralization pass** first, then unify queue sequencing, then remove selected server visual delays incrementally.
