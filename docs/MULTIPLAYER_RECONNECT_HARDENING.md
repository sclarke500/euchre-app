# Multiplayer Reconnect Hardening

## Overview

Multiplayer games (Euchre, President, Spades) experience unreliable state recovery after network disconnection, particularly on mobile devices during sleep/background transitions. This document outlines the root causes, the remediation plan, and implementation status.

## Findings

### Current Architecture

**WebSocket Transport**
- Raw `ws` library (Node.js server), browser WebSocket API (client)
- Server-side heartbeat: 30-second ping/pong interval
- Client-side auto-reconnect: 5 attempts with exponential backoff (1s base delay)

**State Architecture**
- Server-authoritative game state with per-player filtered snapshots
- Pinia stores manage client-side state (lobbyStore, multiplayerGameStore, euchreMultiplayerStore, etc.)
- GameAdapter abstraction allows components to reference game uniformly across modes

**Current Reconnect Pattern**
Two overlapping mechanisms:
1. **Transport layer** (websocket.ts): Fires `onReconnect` handlers on socket open
2. **Lobby layer** (lobbyStore.ts): Catches reconnect, calls `joinLobby()` to re-identify, then fires ad hoc `request_state`
3. **Game layer watchdog**: Polls every ~10s if no game_state arrives while waiting on player (createMultiplayerResyncWatchdog)

### Identified Issues

#### 1. Server-Side Message Delivery Flaw (CRITICAL)
**File**: `packages/server/src/orchestration/messaging.ts`

The `sendToPlayer(odusId)` function breaks at the first matching socket:
```typescript
function sendToPlayer(odusId: string, message: ServerMessage): void {
  for (const [ws, client] of clients) {
    if (client.player?.odusId === odusId) {
      send(ws, message)
      break  // ← PROBLEM: During reconnect, loses messages to stale socket
    }
  }
}
```

**Impact**: During brief window when both old and new sockets exist for same player, targeted messages (`your_turn`, `turn_reminder`, reconnect-triggered `game_state`) go to stale socket and are lost. `broadcastToGame` still reaches new socket (no break), confirming targeted delivery is isolated flaw.

#### 2. Overlapping Reconnect Triggers
**File**: `packages/client/src/stores/lobbyStore.ts`

Reconnect fires two sequential requests:
- `joinLobby()` already triggers `resendStateToPlayer` server-side
- Ad hoc `request_state` sent immediately after (redundant, timing-sensitive)

Result: Two state snapshots can race, creating ambiguity about which is authoritative.

#### 3. Mobile Lifecycle Gaps
No handling of:
- Page Visibility API (`visibilitychange` event) - when tab hidden/visible
- Page Lifecycle API (`freeze`/`resume` events, `document.wasDiscarded` flag)
- `online`/`offline` events - network state changes
- `pagehide` lifecycle - app backgrounding

**Impact**: Backgrounded tabs treated as ordinary packet loss. No explicit recovery trigger when app resumes. Phone sleep can exhaust 5-attempt retry budget.

#### 4. Shallow Reconnect Retry Budget
**File**: `packages/client/src/services/websocket.ts`

Only 5 max reconnect attempts (L24) with 1s base delay (L25):
- Attempt 1: 1s delay
- Attempt 2: 2s delay
- Attempt 3: 4s delay
- Attempt 4: 8s delay
- Attempt 5: 16s delay
- **Total: 31 seconds**

Mobile phones that sleep longer than 31s will exhaust retries and stop trying.

#### 5. Recovery Depends on Polling
**File**: `packages/client/src/stores/multiplayerResync.ts`

Watchdog polls every ~10s (waiting threshold: 10s, idle threshold: 30s). Recovery is not deterministic—feels random to user.

#### 6. No Explicit Recovery State
No way for UI to distinguish between:
- Normal gameplay
- Recovering from disconnect
- Unrecoverable error

Result: Players can click cards during recovery, creating desync if clicks process before state arrives.

### External Pattern Analysis

Investigated Socket.IO, SignalR, Chrome Lifecycle, MDN, and Ably implementations:

**Socket.IO**: Stores client state for configurable duration (default 2min), uses session ID + offset for recovery
**SignalR**: Automatic reconnect with customizable retry policy, separate onreconnecting/onreconnected states
**Chrome Lifecycle**: Freeze/resume events, `document.wasDiscarded` flag for explicit recovery triggers
**All sources agree**: Lifecycle awareness + explicit session recovery essential for mobile reliability

---

## Remediation Plan

### Phase 1: Fix Core Bugs + Explicit Handshake (IMPLEMENTED ✅)

**P1.1: Fix sendToPlayer race**
- **File**: `packages/server/src/orchestration/messaging.ts`
- **Change**: Send to all OPEN sockets for player, don't break at first match
- **Benefit**: Targeted messages reach active socket even during reconnect window
- **Testing**: Verify WebSocket logs show message sent to correct socket

**P1.2: Unify reconnect handshake**
- **File**: `packages/client/src/stores/lobbyStore.ts`
- **Change**: Remove ad hoc `request_state` call; rely on `joinLobby` server trigger
- **Benefit**: Single deterministic flow instead of racing triggers
- **Testing**: Monitor only one state resend per reconnect cycle

**P1.3: Add recovery state tracking**
- **Files**: 
  - `packages/client/src/games/euchre/euchreMultiplayerStore.ts`
  - `packages/client/src/games/president/presidentMultiplayerStore.ts`
  - `packages/client/src/games/spades/spadesMultiplayerStore.ts`
- **Change**: Add `recoveryState` enum ('unknown' | 'recovering' | 'recovered')
  - Set to 'recovering' on `initialize()`
  - Set to 'recovered' when fresh `game_state` arrives
  - Reset to 'unknown' on `cleanup()`
- **Benefit**: UI can know recovery is in progress
- **Testing**: Console logs show state transitions

**P1.4: Add recovery guards to UI**
- **Files**:
  - `packages/client/src/games/euchre/EuchreEngineBoard.vue`
  - `packages/client/src/games/president/PresidentEngineBoard.vue`
  - `packages/client/src/games/spades/SpadesEngineBoard.vue`
- **Change**: Block card clicks if `recoveryState !== 'recovered'`
- **Benefit**: Player cannot play cards while state is stale
- **Testing**: Attempt to play card during recovery → click blocked

**P1.5: Expose recoveryState through game adapters**
- **Files**:
  - `packages/client/src/games/euchre/useEuchreGameAdapter.ts`
  - `packages/client/src/games/president/usePresidentGameAdapter.ts`
  - `packages/client/src/games/spades/useSpadesGameAdapter.ts`
- **Change**: Add `recoveryState` to adapter interface
  - Singleplayer: Always 'recovered' (no reconnect)
  - Multiplayer: Returns store's recoveryState
- **Benefit**: Consistent access pattern for board components
- **Testing**: Adapter correctly exposes state

---

### Phase 2: Mobile Lifecycle Awareness (IMPLEMENTED ✅)

**Goal**: Explicitly detect app backgrounding and trigger recovery on resume

**Key insight that shaped the implementation**: On mobile (especially iOS Safari /
PWAs) JavaScript is *frozen* while the app is backgrounded — `setTimeout` chains do
not run. So a timer-based retry loop is useless during sleep; the only reliable moment
to recover is the instant the app is foregrounded. The implementation therefore lives
in the transport layer (`websocket.ts`) and is driven by resume events, not timers.

The original plan proposed a separate `usePageLifecycle.ts` composable wired through
`lobbyStore`. We instead folded the lifecycle handling directly into the WebSocket
service, because it needs to drive the socket's own connect/backoff state — keeping it
in one place avoids a composable↔store↔transport round-trip and a second source of
truth for "are we connected".

**P2.1 + P2.2: Resume-triggered reconnect (in transport)**
- **File**: `packages/client/src/services/websocket.ts`
- **Change**: `bindLifecycle()` registers `visibilitychange`, `online`, and `pageshow`
  listeners (once). `handleResume()` fires on foreground / network-restore:
  - If the socket is not `OPEN` → reconnect immediately (reset backoff budget).
  - If the socket *reports* `OPEN` but the app was hidden ≥10s → force a clean
    reconnect to validate it (guards against iOS "zombie" half-dead sockets).
- **Benefit**: Recovery happens within ~1s of resume, not after a frozen/exhausted
  timer or the 10s store-watchdog poll. Reuses the existing `onReconnect` contract, so
  the `recoveryState` lock and `joinLobby → resendStateToPlayer` handshake fire as-is.
- **Testing**: Background app for 30s+, resume → board unlocks within ~1s.

**P2.3: Extend WebSocket retry budget**
- **File**: `packages/client/src/services/websocket.ts`
- **Change**: Removed the hard 5-attempt stop entirely. Backoff is now capped at 30s
  with ±50% jitter and retries indefinitely; resume events short-circuit to an
  immediate reconnect with a reset attempt counter. A `userClosed` flag (set by
  `disconnect()`) is what suppresses auto-reconnect, replacing the old
  "poison the attempt counter" approach. Concurrent-connect guards (`connecting` flag,
  single `pendingRetry`, shared `connectPromise`) prevent duplicate sockets when
  multiple resume triggers fire at once.
- **Benefit**: Survives arbitrarily long sleep/wake cycles (5 min, 5 hours) without
  exhausting retries.
- **Testing**: Sleep 2+ minutes, wake → reconnects successfully.

**Server-side note (no change required)**: The server already holds a disconnected
player's seat *indefinitely* — `onClose` calls `markPlayerDisconnected` (it does not
free the seat or auto-replace with AI), there is no idle-game GC, and `odusId` persists
in `localStorage`. So for "one player sleeps 5 min while others wait", the entire fix is
client-transport-side; the server resends a full filtered snapshot on rejoin via
`handleJoinLobby → findRuntimeByPlayer → resendStateToPlayer`.

---

### Phase 3: Server-Side Message Buffer (OPTIONAL - Only if Phase 1-2 fail)

**Goal**: Guard against edge cases where Phase 1-2 still miss messages

**P3.1: Per-game message replay buffer**
- **Files**: `packages/server/src/games/*/` (game implementations)
- **Change**: 
  - Track last 100 messages per game (or 30-second window)
  - On reconnect, send offset-based replay to recovering player
- **Benefit**: Deterministic recovery even for complex message sequences
- **Testing**: Verify no state divergence after complex game sequences

**P3.2: Session token + state versioning**
- **File**: `packages/server/src/sessions/`
- **Change**:
  - Generate session token per connection
  - Track state version per game
  - On reconnect, validate token and send version mismatch correction
- **Benefit**: Server can detect stale clients and force resync
- **Testing**: Verify stale state is corrected

---

## Implementation Status

### ✅ Phase 1: COMPLETE

**Implemented:**
- [x] P1.1: Fixed `sendToPlayer` to send to all open sockets
- [x] P1.2: Unified reconnect handshake in `lobbyStore`
- [x] P1.3: Added `recoveryState` to all multiplayer stores
- [x] P1.4: Added recovery guards to all board components
- [x] P1.5: Exposed `recoveryState` through all game adapters

**Follow-up fixes (review pass):**
- [x] Fixed a build-breaking syntax error in `euchreMultiplayerStore.ts` cleanup
      (three statements had collapsed onto one line).
- [x] Made the recovery guard *actually engage on reconnect*. Originally
      `recoveryState` only became `'recovering'` inside `initialize()`, which runs once
      on board mount — never on a real reconnect — so the guard was inert during the
      exact scenario it exists for. Each multiplayer store now registers its own
      `websocket.onReconnect` handler that flips `recoveryState` back to `'recovering'`
      (and tears it down in `cleanup()`).
- [x] Fixed the Spades guard, which read `store.recoveryState?.value` — but
      `store = proxyRefs(adapter)` auto-unwraps refs, so `.value` was always `undefined`
      and the guard silently never blocked (also a `TS2551` type error). Dropped `.value`.

**Files Modified:**
- `packages/server/src/orchestration/messaging.ts` (1 file)
- `packages/client/src/stores/lobbyStore.ts` (1 file)
- `packages/client/src/games/euchre/euchreMultiplayerStore.ts` (1 file)
- `packages/client/src/games/president/presidentMultiplayerStore.ts` (1 file)
- `packages/client/src/games/spades/spadesMultiplayerStore.ts` (1 file)
- `packages/client/src/games/euchre/EuchreEngineBoard.vue` (1 file)
- `packages/client/src/games/president/PresidentEngineBoard.vue` (1 file)
- `packages/client/src/games/spades/SpadesEngineBoard.vue` (1 file)
- `packages/client/src/games/euchre/useEuchreGameAdapter.ts` (1 file)
- `packages/client/src/games/president/usePresidentGameAdapter.ts` (1 file)
- `packages/client/src/games/spades/useSpadesGameAdapter.ts` (1 file)

**Total: 11 files changed**

### ✅ Phase 2: COMPLETE

- [x] P2.1 + P2.2: Resume-triggered reconnect via `visibilitychange` / `online` /
      `pageshow` listeners in `websocket.ts`, with zombie-socket validation.
- [x] P2.3: Capped + jittered backoff, no hard attempt limit, `userClosed` flag,
      concurrent-connect guards.

**Files Modified:**
- `packages/client/src/services/websocket.ts` (1 file)

### ⛔ Phase 3: NOT NEEDED (do not implement)

- [ ] ~~P3.1: Per-game message replay buffer~~
- [ ] ~~P3.2: Session token + state versioning~~

The server is authoritative and already resends a **full filtered snapshot** on rejoin
(`resendStateToPlayer`). There is no incremental client-side message stream to replay,
so an offset/replay buffer and session-token versioning would add real race-condition
surface for zero benefit here. Recovery is full-snapshot by design. Revisit only if a
future feature introduces client-side state that the server cannot fully reconstruct.

---

## Testing Strategy

### Phase 1 Verification

**1. Unit Tests**
```
Test: sendToPlayer sends to all OPEN sockets with matching odusId
Test: recoveryState transitions correctly (unknown → recovering → recovered)
Test: Board blocks clicks when recoveryState !== 'recovered'
```

**2. Manual Testing**
```
Scenario: Start multiplayer game, toggle WiFi off, wait 10s, toggle on
Expected: Board unlocks after ~1-2s, game resumes normally
Actual: [To be tested]

Scenario: Multiple players reconnect simultaneously
Expected: Each player's state syncs independently, no message loss
Actual: [To be tested]

Scenario: Rapid reconnect (toggle WiFi on/off quickly)
Expected: No state divergence, only one game_state processed per recovery
Actual: [To be tested]
```

**3. Browser DevTools Analysis**
```
Check WebSocket messages:
- Verify only fresh socket receives targeted messages post-reconnect
- Confirm no duplicate game_state messages in same recovery window
- Watch console for "[Game] Blocking card click during recovery state" logs
```

### Phase 2 Verification (after implementation)

**1. Mobile Testing**
```
Scenario: Background app (home button), wait 30s, resume
Expected: Board unlocks immediately (no 10s wait)
Actual: [To be tested]

Scenario: Sleep phone for 2+ minutes, wake
Expected: Reconnects successfully (retries not exhausted)
Actual: [To be tested]
```

**2. Network Simulation**
```
Use browser DevTools Network tab:
- Set to "Offline", start game, set to "Online"
- Verify recovery happens within 1s (not 10s polling interval)
```

---

## Success Criteria

- [ ] **No message loss**: Targeted messages (your_turn, turn_reminder, game_state) reach active socket 100% of time post-reconnect
- [ ] **Single handshake**: Reconnect triggers exactly one join_lobby + one request_state pair
- [ ] **Explicit recovery**: UI shows recoveryState transition; board unclickable during recovery
- [ ] **Fast recovery**: Board interactive within 1-2 seconds of socket reconnect
- [ ] **Mobile resilience**: Survives multiple sleep/wake cycles without retry exhaustion
- [ ] **No state divergence**: All players converge on same game state post-recovery

---

## Risk Assessment

### Phase 1 Risks
- **Low**: Only fixes isolated bugs, no architectural changes
- **Mitigation**: Existing watchdog provides fallback recovery if Phase 1 incomplete

### Phase 2 Risks
- **Medium**: Adds event listeners that might conflict with other code
- **Mitigation**: Lifecycle events widely supported; test on target devices

### Phase 3 Risks
- **High**: Adds server-side complexity; message replay can cause race conditions if not careful
- **Mitigation**: Only pursue if Phase 1-2 insufficient

---

## Rollback Plan

All changes are isolated and can be reverted independently:

1. **P1.1 revert**: Restore `sendToPlayer` break statement (one line)
2. **P1.2 revert**: Restore ad hoc `request_state` call (3 lines)
3. **P1.3-1.4 revert**: Remove `recoveryState` refs and guards (isolated changes)
4. **P1.5 revert**: Remove `recoveryState` from adapter interfaces (isolated changes)

No database migrations or state schema changes, so zero risk of persistent corruption.

---

## Next Steps

1. **Device test** (Phase 1 + 2 are in): on a real phone, start a multiplayer game,
   lock the phone for 5 minutes while another player waits, then unlock → the board
   should show a brief recovering state and then go live with the seat intact.
2. **Optional, separate from reconnect** (UX/hygiene, not required for the wait-and-rejoin
   scenario):
   - Auto-AI takeover after a grace period, so a table isn't *forced* to wait
     indefinitely on someone who never returns (today boot is manual-only).
   - Idle-game garbage collection on the server (e.g. drop a game with all humans gone
     for >30 min) for long-running-server memory hygiene.
3. **Long-term**: Monitor production telemetry. Phase 3 is intentionally not planned
   (see above).

---

## Related Documentation

- [MULTIPLAYER_ARCHITECTURE.md](MULTIPLAYER_ARCHITECTURE.md) - WebSocket design and message protocol
- [TIMING_ARCHITECTURE.md](TIMING_ARCHITECTURE.md) - Turn timer and game loop timing
- [ROADMAP.md](ROADMAP.md) - Feature prioritization and upcoming work
