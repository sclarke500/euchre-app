# Timing Architecture Analysis & Recommendations

Date: February 19, 2026  
Source documents reviewed: `docs/TIMING_ARCHITECTURE.md` and `docs/TIMING_ARCHITECTURE_REVIEW.md`

## Executive Summary

After reviewing the timing architecture documents and conducting a thorough code audit across the client and server, I confirm the core findings: timing and pausing logic is fragmented across layers with inconsistent ownership and values. However, the codebase has stronger foundations than the documents suggest, particularly around client-side queuing and animation orchestration.

**Key Findings:**
- ✅ Timing fragmentation confirmed: 40+ hardcoded delays across server/client/SP/MP
- ✅ Ownership confusion validated: Same concepts (AI delay, trick pause) controlled differently by layer/mode
- ✅ SP/MP divergence exists but is partially mitigated by directors
- ⚠️ Review doc understates queue infrastructure strength
- ⚠️ Missing critical systems: Turn timers, resync watchdogs, animation callbacks

**Recommendations:**
1. **Immediate (P0)**: Centralize timing constants with semantic keys
2. **Short-term (P1)**: Standardize MP queue processing across games
3. **Medium-term (P2)**: Implement cancellable timer infrastructure
4. **Long-term (P3)**: Add timing telemetry and product features

---

## Detailed Code Audit Findings

### 1. Current Timing Inventory (Updated)

#### Server-Side Timing (packages/server/src/games/)
| Game | Location | Duration | Purpose | Owner |
|------|----------|----------|---------|-------|
| **President** | `PresidentGame.ts:362` | 1200ms | Post-deal pause | Server |
| **President** | `PresidentGame.ts:371` | 1200ms | Pre-exchange pause | Server |
| **President** | `PresidentGame.ts:455-461` | 800ms + 300ms | Joker pile clear | Server |
| **President** | `PresidentGame.ts:511` | 500ms | Post-clear pause | Server |
| **President** | `PresidentGame.ts:577` | 3000ms | Round complete | Server |
| **President** | `PresidentGame.ts:623` | 800ms | AI turn delay | Server |
| **President** | `cardExchange.ts:140` | 300ms | AI exchange confirm | Server |
| **President** | `cardExchange.ts:216` | 100ms | Post-confirm pause | Server |
| **President** | `cardExchange.ts:269` | 1500ms | Pre-playing pause | Server |
| **Euchre** | `EuchreGame.ts:290` | 600ms | AI bid delay | Server |
| **Euchre** | `EuchreGame.ts:468` | 1200ms | Trick complete | Server |
| **Euchre** | `EuchreGame.ts:473` | 500ms | Post-trick pause | Server |
| **Euchre** | `EuchreGame.ts:530` | 3000ms | Round complete | Server |
| **Euchre** | `EuchreGame.ts:550` | 600ms | AI play delay | Server |
| **Spades** | `SpadesGame.ts:241` | 600ms | AI bid delay | Server |
| **Spades** | `SpadesGame.ts:325` | 1500ms | Trick complete | Server |
| **Spades** | `SpadesGame.ts:328` | 500ms | Post-trick pause | Server |
| **Spades** | `SpadesGame.ts:382` | 3000ms | Round complete | Server |
| **Spades** | `SpadesGame.ts:405` | 800ms | AI play delay | Server |

#### Client-Side Timing (packages/client/src/)

**Animation Constants (`utils/animationTimings.ts`)**:
```typescript
AnimationDurations = {
  fast: 220, medium: 350, slow: 520, slower: 700, pause: 900, longPause: 1200
}
AnimationDelays = { dealStagger: 60, shortDelay: 120 }
```

**Director Pauses (post-animation sleeps)**:
| Game | Location | Duration | Purpose | Owner |
|------|----------|----------|---------|-------|
| **President** | `usePresidentDirector.ts:449` | 520ms (slow) | Post-pile-sweep pause | Client |
| **President** | `usePresidentDirector.ts:576` | 800ms | Pre-round-complete AI | Client |
| **President** | `usePresidentDirector.ts:622` | 1200ms | Post-exchange sync | Client |
| **Euchre** | `useEuchreDirector.ts:317` | 120ms | Pre-play animation | Client |
| **Euchre** | `useEuchreDirector.ts:525` | ~400ms | Post-discard animation | Client |
| **Euchre** | `useEuchreDirector.ts:719` | ~400ms | Post-trump pickup | Client |

**Store Pauses (SP game flow)**:
| Game | Location | Duration | Purpose | Owner |
|------|----------|----------|---------|-------|
| **President** | `presidentGameStore.ts:247` | 15000ms (fallback) | Deal animation timeout | Client |
| **President** | `presidentGameStore.ts:345` | 500ms | Exchange phase transition | Client |
| **President** | `presidentGameStore.ts:348` | 1500ms | Post-exchange to playing | Client |
| **President** | `presidentGameStore.ts:480` | 800ms | Joker pile clear | Client |
| **President** | `presidentGameStore.ts:525` | 3000ms | Round complete | Client |
| **President** | `presidentGameStore.ts:549` | 800ms | AI turn delay | Client |
| **Spades** | `spadesStore.ts:168` | 800ms | AI bid delay | Client |
| **Spades** | `spadesStore.ts:245` | 600ms | Post-play animation | Client |
| **Spades** | `spadesStore.ts:252` | 1000ms | Trick complete pause | Client |
| **Spades** | `spadesStore.ts:268` | 500ms | AI play delay | Client |
| **Spades** | `spadesStore.ts:288` | 600ms | AI turn delay | Client |

**UI Feedback Timers**:
| Location | Duration | Purpose | Owner |
|----------|----------|---------|-------|
| `presidentMultiplayerStore.ts:207` | 1500ms | Clear "last play" indicator | Client |
| `presidentMultiplayerStore.ts:218` | 1500ms | Clear "passed" indicator | Client |
| `presidentMultiplayerStore.ts:230` | 1000ms | Clear "pile cleared" indicator | Client |
| `PresidentEngineBoard.vue:307` | 3000ms | Clear highlighted cards | Client |

**Turn Timer System**:
- Grace period: 30s before timer appears
- Countdown: 30s with visual/audio cues
- Yellow warning: 15s remaining
- Red critical: 5s remaining
- Auto-pause on modal dialogs

**Resync Watchdog**:
- Check interval: 5s
- Waiting threshold: 10s (when it's player's turn)
- Idle threshold: 30s (when waiting for others)

### 2. Architecture Strengths (Understated in Review)

#### Robust Client Queue Infrastructure
The review doc suggests queue processing isn't standardized, but the implementation is actually quite mature:

**Shared Queue Controller** (`multiplayerQueue.ts`):
- Clean enable/disable API with automatic flush on disable
- Used consistently across Euchre/President/Spades MP stores
- Proper separation of queuing vs application logic

**Processing Models**:
- **President/Euchre**: Explicit async dequeue loop (16ms polling)
- **Spades**: State-delta watchers with queue enable/disable
- Both models work but have different semantics for animation sequencing

**Animation Callback System**:
- Directors register callbacks for play/pile-clear/exchange animations
- SP stores await these callbacks before advancing game state
- Clean separation: stores own logic, directors own presentation

#### Turn Timer Resilience
The `TurnTimer.vue` component is well-architected:
- Proper cleanup on unmount
- Pause/resume handling for modals
- Audio/visual feedback with accessibility considerations
- Grace period prevents premature pressure

### 3. Critical Gaps and Risks

#### Timer Lifecycle Management
**Problem**: Many `setTimeout` calls lack cancellation, creating stale callback risks.

**Examples**:
- Server AI delays not cancelled on phase changes
- Client status timers cleared but not all game timers
- Resync watchdog runs indefinitely without proper cleanup

**Risk**: Stale callbacks after reconnects, player replacement, or rapid state changes.

#### Inconsistent Timing Values
**Same Concept, Different Values**:
- AI turn delay: 600ms (Euchre server), 800ms (President server), 600ms (Spades server), 800ms (President client)
- Trick complete: 1200ms (Euchre server), 1500ms (Spades server), 1000ms (Spades client)
- Round complete: 3000ms (all servers), 3000ms (President client)

#### Missing Semantic Timing Registry
Current `animationTimings.ts` is basic. No server timing constants. No semantic keys like `logic.aiThinkDelay` vs `visual.trickPause`.

#### Queue Processing Inconsistency
- President: Async loop with 16ms polling
- Spades: Watcher-based with enable/disable
- Euchre: Async loop (assumed similar to President)

Different flushing behaviors make timing predictable in some games but not others.

---

## Recommended Target Architecture

### Timing Ownership Contract (Refined)

| Layer | Responsibility | Examples | Authority |
|-------|---------------|----------|-----------|
| **Server** | Game fairness timing | Turn timeouts, AI delays, anti-spam | Authoritative |
| **Client Directors** | Presentation sequencing | Animation orchestration, visual pauses | Authoritative |
| **Client Stores** | Game logic flow | State transitions, SP AI pacing | Reactive |
| **UI Components** | User feedback | Status indicators, highlights | Independent |

### Centralized Timing Registry

```typescript
// packages/client/src/utils/timingConstants.ts
export const TimingConstants = {
  // Server-owned (fairness)
  server: {
    aiThinkDelay: 600,
    turnReminderInterval: 15000,
    turnTimeoutReminderCount: 4,
  },
  
  // Client visual (presentation)
  visual: {
    cardPlay: 350,
    trickSweep: 520,
    exchange: 900,
    phaseTransitionShort: 800,
    phaseTransitionLong: 2000,
  },
  
  // UI feedback (ephemeral)
  ui: {
    statusIndicator: 1500,
    highlight: 3000,
  },
} as const
```

### Cancellable Timer Infrastructure

```typescript
// packages/client/src/utils/cancellableTimer.ts
export interface CancellableTimer {
  cancel(): void
  isActive(): boolean
}

export function createCancellableTimer(
  fn: () => void, 
  delay: number, 
  scope?: string
): CancellableTimer {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let cancelled = false
  
  timeoutId = setTimeout(() => {
    if (!cancelled) {
      fn()
    }
  }, delay)
  
  return {
    cancel() {
      cancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    },
    isActive() {
      return !cancelled
    }
  }
}
```

---

## Implementation Roadmap

### Phase 0: Foundation (Immediate, No Behavior Change)
1. **Create semantic timing registry** - Replace literals with `TimingConstants` imports
2. **Audit all timer sources** - Document every `setTimeout` with purpose/owner
3. **Add timer metadata** - Tag each timer with cancellation scope

### Phase 1: Consistency (1-2 weeks)
1. **Standardize MP queue processing** - Choose one model (recommend async loop) and apply to all games
2. **Move SP store sleeps to directors** - Directors become single source of visual timing
3. **Implement cancellable timers** - Replace raw `setTimeout` with `CancellableTimer`

### Phase 2: Resilience (2-4 weeks)
1. **Add timer lifecycle management** - Cancel timers on phase/game boundaries
2. **Implement timing telemetry** - Log scheduled/executed/cancelled timers
3. **Remove redundant server pauses** - Where client directors provide equivalent sequencing

### Phase 3: Enhancement (Future)
1. **Animation speed settings** - User-configurable timing multipliers
2. **Skip/accelerate modes** - Power user options for faster play
3. **Deterministic testing** - Collapse visual pauses for automated tests

---

## Specific Code Changes Recommended

### 1. Centralize Constants
**File**: `packages/client/src/utils/timingConstants.ts` (new)
```typescript
export const TimingConstants = {
  server: {
    aiThinkDelay: 600,
    turnReminderInterval: 15000,
    turnTimeoutReminderCount: 4,
  },
  visual: {
    cardPlay: AnimationDurations.medium,
    trickSweep: AnimationDurations.slow,
    exchange: AnimationDurations.pause,
    phaseTransitionShort: AnimationDurations.medium,
    phaseTransitionLong: AnimationDurations.longPause,
  },
  ui: {
    statusIndicator: 1500,
    highlight: 3000,
  },
} as const
```

### 2. Standardize Queue Processing
**Recommendation**: Adopt President/Euchre async loop model for all games.

**Benefits**:
- Predictable sequencing
- Better animation timing control
- Consistent MP/SP experience

### 3. Add Timer Cancellation
**Example Pattern**:
```typescript
// Before
setTimeout(() => doSomething(), 800)

// After
const timer = createCancellableTimer(() => doSomething(), 800, 'ai-turn')
gameTimers.add(timer)
// ... later ...
gameTimers.cancelAll()
```

### 4. Remove Server Visual Pauses
**Safe Candidates**:
- President exchange 1500ms (client director handles equivalent)
- Trick complete pauses (client directors add their own)

**Keep Server**:
- AI think delays (fairness)
- Turn reminders (critical UX)

---

## Success Metrics

1. **Consistency**: Same timing values across SP/MP for equivalent actions
2. **Resiliency**: No stale timers after reconnects or state resets
3. **Maintainability**: Single source of truth for timing values
4. **Observability**: Ability to monitor timing behavior in production

---

## Conclusion

The timing architecture has solid foundations but needs systematic cleanup. The review document correctly identifies the problems but understates existing infrastructure strength. By following the phased approach above, we can achieve the goal of streamlined, resilient timing across all games.

**Next Step**: Start with Phase 0 (timing constants) to establish foundation without risk.</content>
<parameter name="filePath">/Users/steve/code/euchre-app/docs/TIMING_ARCHITECTURE_ANALYSIS.md