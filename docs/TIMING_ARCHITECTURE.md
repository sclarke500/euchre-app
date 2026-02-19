# Timing & Pause Architecture

## Current State: A Mishmash

The app currently has timing/pauses scattered across server and client with no unified pattern. This document audits all timing code and proposes a cleaner architecture.

---

## Current Timing Inventory

### Server-Side Pauses (packages/server/src/games/)

| Game | Location | Duration | Purpose |
|------|----------|----------|---------|
| **President** | `PresidentGame.ts:362` | 1200ms | After deal, before exchange starts |
| **President** | `PresidentGame.ts:371` | 1200ms | After deal, before playing (first round) |
| **President** | `PresidentGame.ts:455-461` | 800ms + 300ms | Joker played → pile clear |
| **President** | `PresidentGame.ts:511` | 500ms | Pile cleared, before next turn |
| **President** | `PresidentGame.ts:577` | 3000ms | Round complete → next round |
| **President** | `PresidentGame.ts:623` | 800ms | AI turn delay |
| **President** | `cardExchange.ts:140` | 300ms | AI auto-confirm exchange |
| **President** | `cardExchange.ts:216` | 100ms | After all confirmations, before distribution |
| **President** | `cardExchange.ts:269` | 1500ms | After exchange distribution, before playing |
| **Euchre** | `EuchreGame.ts:290` | 600ms | AI bid delay |
| **Euchre** | `EuchreGame.ts:468` | 1200ms | Trick complete pause |
| **Euchre** | `EuchreGame.ts:473` | 500ms | Pile cleared, before next turn |
| **Euchre** | `EuchreGame.ts:530` | 3000ms | Round complete → next round |
| **Euchre** | `EuchreGame.ts:550` | 600ms | AI play card delay |
| **Spades** | `SpadesGame.ts:241` | 600ms | AI bid delay |
| **Spades** | `SpadesGame.ts:325` | 1500ms | Trick complete pause |
| **Spades** | `SpadesGame.ts:328` | 500ms | After trick, before next turn |
| **Spades** | `SpadesGame.ts:382` | 3000ms | Round complete → next round |
| **Spades** | `SpadesGame.ts:405` | 800ms | AI play card delay |

### Client-Side Pauses (packages/client/src/)

#### Animation Timing Constants (`utils/animationTimings.ts`)
```typescript
AnimationDurations = {
  fast: 220,
  medium: 350,
  slow: 520,
  slower: 700,
  pause: 900,
  longPause: 1200,
}

AnimationDelays = {
  dealStagger: 60,
  shortDelay: 120,
}
```

#### Director Pauses (post-animation sleeps)

| Game | Location | Duration | Purpose |
|------|----------|----------|---------|
| **President** | `usePresidentDirector.ts:449` | 520ms (slow) | After pile sweep animation |
| **President** | `usePresidentDirector.ts:576` | 800ms | After last AI play before round complete |
| **President** | `usePresidentDirector.ts:622` | 1200ms | After exchange hand sync, before playing |
| **Euchre** | `useEuchreDirector.ts:317` | 120ms | Short delay before play animation |
| **Euchre** | `useEuchreDirector.ts:525` | ~400ms | After discard animation |
| **Euchre** | `useEuchreDirector.ts:719` | ~400ms | After trump picked up |

#### Store Pauses (SP game flow)

| Game | Location | Duration | Purpose |
|------|----------|----------|---------|
| **President** | `presidentGameStore.ts:247` | 15000ms (fallback) | Deal animation timeout |
| **President** | `presidentGameStore.ts:345` | 500ms | Between exchange phases |
| **President** | `presidentGameStore.ts:348` | 1500ms | After exchange → playing |
| **President** | `presidentGameStore.ts:446` | 1500ms | After human ack → playing |
| **President** | `presidentGameStore.ts:480` | 800ms | Joker pile clear |
| **President** | `presidentGameStore.ts:525` | 3000ms | Round complete → next round |
| **President** | `presidentGameStore.ts:549` | 800ms | AI turn delay |
| **Spades** | `spadesStore.ts:168` | 800ms | AI bid delay |
| **Spades** | `spadesStore.ts:245` | 600ms | After play animation |
| **Spades** | `spadesStore.ts:252` | 1000ms | Trick complete pause |
| **Spades** | `spadesStore.ts:268` | 500ms | AI play delay |
| **Spades** | `spadesStore.ts:288` | 600ms | AI turn delay |

#### UI Feedback Timers

| Location | Duration | Purpose |
|----------|----------|---------|
| `presidentMultiplayerStore.ts:207` | 1500ms | Clear "last play" indicator |
| `presidentMultiplayerStore.ts:218` | 1500ms | Clear "passed" indicator |
| `presidentMultiplayerStore.ts:230` | 1000ms | Clear "pile cleared" indicator |
| `PresidentEngineBoard.vue:307` | 3000ms | Clear highlighted cards |

---

## Problems with Current Architecture

### 1. Duplicate Pauses (Server + Client)
Example: Exchange flow
- Server pauses 1500ms before sending Playing phase
- Client pauses 1200ms after exchange animation
- Result: 2700ms total pause, unclear which controls timing

### 2. Inconsistent Values
Same concept uses different durations:
- AI turn delay: 600ms (Euchre), 800ms (President/Spades)
- Trick complete: 1200ms (Euchre), 1500ms (Spades)
- Round complete: 3000ms (all) ✓ consistent

### 3. Hardcoded Magic Numbers
Many `setTimeout(fn, 800)` scattered throughout with no constants.

### 4. Unclear Ownership
- Who controls "time to see cards before next phase"? Server or client?
- Who controls "AI thinking time"? Server or client?

### 5. SP vs MP Divergence
- SP stores have their own timing (client-controlled)
- MP relies on server timing
- Same game feels different in SP vs MP

---

## Proposed Architecture

### Principle: Separation of Concerns

| Owner | Responsibility | Examples |
|-------|---------------|----------|
| **Server** | Game logic timing | Turn timeouts, AI decision time, phase transitions |
| **Client** | Presentation timing | Animation duration, visual pauses, UI feedback |

### Concrete Rules

1. **Server sends state changes immediately** — no artificial pauses for "animation time"
2. **Client buffers/queues messages** and processes them after animations complete
3. **Animation durations live in one place** (`animationTimings.ts`)
4. **Post-animation pauses live in directors** (not stores, not server)
5. **AI "thinking" delay stays on server** (for MP) or client store (for SP)

### Proposed Timing Constants

```typescript
// utils/animationTimings.ts

export const AnimationDurations = {
  // Card movements
  fast: 220,        // quick repositions
  medium: 350,      // standard card play
  slow: 520,        // deliberate movements (trick sweep)
  exchange: 900,    // card exchange (slower for visibility)
  
  // Pauses (no card movement, just waiting)
  shortPause: 300,  // micro-pause between actions
  mediumPause: 800, // see-what-happened pause
  longPause: 1200,  // major event (trick complete, exchange complete)
  phasePause: 2000, // phase transition (round complete)
}

export const AIDelays = {
  thinking: 600,    // AI "thinking" before action
  turn: 800,        // before AI turn starts
}

export const UIFeedback = {
  indicator: 1500,  // "last play" / "passed" indicators
  highlight: 3000,  // highlighted cards
}
```

### Migration Path

#### Phase 1: Consolidate Constants
- Move all hardcoded values to `animationTimings.ts`
- Keep behavior identical, just centralize values
- Low risk, easy to verify

#### Phase 2: Remove Server Animation Pauses
- Remove server `setTimeout` for "animation time" (like exchange 1500ms)
- Client already handles these via director
- Test MP carefully

#### Phase 3: Unify SP/MP Client Timing
- SP stores delegate all visual timing to directors
- Same timing experience in SP and MP
- Directors use animation callbacks

#### Phase 4: Document & Enforce
- Add comments explaining each pause
- Code review checklist: "Is this timing in the right place?"

---

## Decision Points for Review

1. **Should AI delay be server or client?**
   - Server: Consistent for all clients, feels more "real"
   - Client: Faster feel, no network latency in delay

2. **Should we support configurable animation speed?**
   - Settings: "Animation Speed: Slow / Normal / Fast"
   - Accessibility benefit for users who want faster play

3. **Should trick/round pauses be skippable?**
   - "Tap to continue" option
   - Power users want to move faster

---

## Files to Modify (Reference)

### Server
- `packages/server/src/games/president/PresidentGame.ts`
- `packages/server/src/games/president/cardExchange.ts`
- `packages/server/src/games/euchre/EuchreGame.ts`
- `packages/server/src/games/spades/SpadesGame.ts`

### Client
- `packages/client/src/utils/animationTimings.ts`
- `packages/client/src/games/*/use*Director.ts`
- `packages/client/src/games/*/*Store.ts`
- `packages/client/src/composables/useCardController.ts`
