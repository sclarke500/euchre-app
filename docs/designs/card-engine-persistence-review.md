# Card Engine Persistence Review & Recommendations

Date: 2026-02-21

## Executive Summary

The proposed direction in `card-engine-persistence.md` is strong and addresses the right problem: card-engine visuals are ephemeral, while multiplayer rehydration currently depends on future server messages and ad-hoc sync paths.

My recommendation is to **keep the plan**, but tighten it in three places:

1. Persist a **semantic snapshot** (container ownership + card order + face state), not raw per-card x/y positions as the source of truth.
2. Gate restore with a **server-state fingerprint** (`stateSeq` + phase/round/trick metadata) to avoid restoring stale visuals.
3. Implement restore as a **two-stage bootstrap**: instant local paint, then authoritative reconciliation when next `*_game_state` arrives.

This gives fast wake/reconnect UX without increasing visual corruption risk.

---

## What I Observed in Current Code

## 1) Engine state is fully in-memory and reset-prone
- `useCardTable` is an in-memory container graph with refs to mounted card components.
- `reset()` clears deck/hands/piles/cardRefs immediately.
- `useSpadesDirector` calls `engine.reset()` on unmount; other flows also rebuild tables during phase transitions.

Impact: if mobile suspends/recreates the view tree, engine visuals are gone until directors rebuild from incoming state/events.

## 2) There are partial restore mechanisms, but no generalized persistence
- `useCardController.restoreHands()` exists (originally for SP restore flows).
- `restoreWonTrickStacks()` exists and is reusable for trick-taking games.
- Multiplayer catch-up logic is game-specific and inconsistent (mostly hand sync, not full board snapshot restore).

Impact: user hand may recover, but center pile/trick stacks/deck state can lag or appear empty/glitched after wake/reconnect.

## 3) Reconnect relies on network timing and queue processing
- Reconnect path triggers `request_state` from lobby + game stores.
- Directors process queued messages and sometimes handle "same phase" sync if hand is missing.

Impact: if reconnect or mount sequencing delays `game_state`, user can temporarily see no cards.

---

## Review of Existing Plan

## What is good
- Correctly identifies persistence at card-engine layer (`useCardController` + engine/container serialization).
- Correct storage key strategy by game/session.
- Correctly calls out stale-state and game-ended edge cases.
- Hybrid save triggers (visibility + debounced updates) are practical.

## What should change

### A) Do not make absolute coordinates authoritative
Raw x/y/rotation are fragile across:
- orientation changes,
- safe-area changes,
- board size changes,
- table layout changes (`normal` vs `wide`).

Recommendation:
- Persist per-container card ordering and visual flags.
- Recompute positions on restore from container geometry (`getCardPosition`, layout helpers), then optionally apply stored offsets for piles where needed.

### B) Add strict stale validation contract
`maxAge` alone is insufficient.

Recommendation: include a `snapshotMeta` fingerprint:
- `stateSeq` (required for MP)
- `phase`
- `roundNumber` (where applicable)
- `dealer`
- `currentPlayer`
- `myHandCardIds` hash

Only restore if snapshot fingerprint matches latest known server state (or is within a safe pre-sync policy window).

### C) Add two-stage restore lifecycle
1. **Stage 1 (Instant local):** render persisted snapshot immediately on mount/pageshow.
2. **Stage 2 (Authoritative):** when next server `*_game_state` arrives, validate fingerprint:
   - match => keep and continue
   - mismatch => discard snapshot and rebuild from server state

This removes blank screen while still preserving correctness.

---

## Recommended Architecture (Adjusted)

## Snapshot shape (v2)
Persist:
- global: `version`, `savedAt`, `gameType`, `sessionKey`, `snapshotMeta`
- containers:
  - deck: card IDs in order, faceUp state, deck-level properties
  - hands: by seat/container id, card IDs in order, mode (`fanned`/`looseStack`), faceUp policy
  - piles: card IDs in order + optional per-card target positions for custom pile layouts
- card map: `{ id, suit, rank, faceUp }`
- optional `extras` by game (minimal, versioned)

Avoid treating absolute board coordinates as canonical data.

## Storage strategy
- Primary: `sessionStorage`
- Optional fallback: short-TTL `localStorage` (`< 10 min`) with `tabId` for iOS process-kill recovery.

If fallback is added, always namespace by game + session + tabId and clear aggressively on leave/game-over.

## Save triggers
Use all three:
- `visibilitychange` when hidden
- `pagehide` / `freeze` (where available)
- debounced save after animation settle (`~400-600ms`)

Do not save mid-transition; save after movement batches complete.

## Restore triggers
- `onMounted` / board-ready path
- `pageshow` (when returning from bfcache)

Restore should happen before waiting for network resync.

---

## Integration Suggestions by Existing Files

- `packages/client/src/composables/useCardController.ts`
  - Add persistence config and lifecycle hooks.
  - Reuse existing `restoreHands` and `restoreWonTrickStacks` during deserialize.
- `packages/client/src/composables/useCardTable.ts`
  - Add pure serialize/deserialize helpers on engine/container state.
- `packages/client/src/components/cardContainers.ts`
  - Add minimal `toSnapshot/fromSnapshot` helpers per container type.
- Directors (`useEuchreDirector.ts`, `useSpadesDirector.ts`, `usePresidentDirector.ts`)
  - Provide `sessionKey` + `snapshotMeta` inputs.
  - Call `clearPersistedState` on game-over/leave.

---

## Risk Register

1. **Stale-but-plausible visuals**
   - Mitigation: strict fingerprint validation; discard on mismatch.
2. **Layout drift after rotate/resume**
   - Mitigation: recompute positions from layout, not persisted absolute x/y.
3. **Performance overhead from frequent writes**
   - Mitigation: debounce + hidden/pagehide events + only write when dirty.
4. **Complexity spread across games**
   - Mitigation: keep persistence in shared card-controller/engine layer, with only small per-game metadata adapters.

---

## Rollout Plan (Practical)

1. Build shared snapshot schema + serializer/deserializer in engine/controller.
2. Enable for Euchre MP first (highest sensitivity and existing reconnection complexity).
3. Add fingerprint validation against `stateSeq` and phase metadata.
4. Roll to Spades MP, then President MP.
5. Add optional localStorage fallback only if iOS process-kill testing still shows blank states.

---

## Validation Scenarios (Must Pass)

1. Lock phone for 30-120s during active hand, unlock: cards visible immediately.
2. Trigger websocket reconnect during play: no blank hand period.
3. Resume after phase transition happened while sleeping: stale snapshot discarded and rebuilt correctly.
4. Rotate device while suspended: restored positions are correct for new layout.
5. Duplicate tab / open another table: no cross-session visual leakage.

---

## Bottom Line

The current persistence plan is directionally correct and should be implemented. The main adjustment is to treat persistence as **semantic board reconstruction with authoritative reconciliation**, not raw visual coordinate replay. That gives the fast wake UX you want while avoiding subtle stale-state bugs.