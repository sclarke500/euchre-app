# Game Architecture Contract

**Status:** Canonical  
**Audience:** Authors of multiplayer (and singleplayer) card games in this monorepo  
**Related:** `docs/designs/pure-game-architecture-plan.md` (migration plan), `docs/NEW_GAME_GUIDE.md` (implementation checklist)

---

## Purpose

Every multiplayer game must follow the same structure so new games are checklist work, not archaeology.

**Gold-standard reference today:** Spades shared + Spades client apply pattern.  
**Server apply pattern to copy:** President’s `buildState → pure transition → applyState` (Spades server is being migrated to match).

---

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│  packages/shared/src/{game}/                                │
│  Pure rules: (state, action) → state, legalActions, AI      │
└─────────────────────────────────────────────────────────────┘
          ▲ apply only                    ▲ apply only
┌─────────┴──────────┐          ┌─────────┴──────────────────┐
│ Client SP store    │          │ Server *Game class           │
│ animation, AI delay│          │ WS, privacy, stateSeq,       │
│ remarks, settings→ │          │ reminders, disconnect,       │
│ state.rules        │          │ remarks, AI delay            │
└─────────┬──────────┘          └─────────┬──────────────────┘
          │                               │ filtered ClientGameState
          ▼                               ▼
   Adapter → Director → Board      MultiplayerStore → Adapter → …
```

| Layer | Owns | Must not own |
|---|---|---|
| **Shared pure game** | Phase graph, scoring, legality, deal (with optional rng) | Timers, WS, DOM, remarks side effects, global settings stores |
| **Client SP store** | Apply pure results, animation callbacks, AI schedule, remarks instance | Reimplemented phase/score math |
| **Server `*Game`** | Apply pure results, multiplayer shell, projection, AI schedule | Reimplemented bid/play/score transitions |
| **Client MP store** | Wire messages, queue, resync | Authoritative rules |

Client multiplayer layering (unchanged):

```
MultiplayerStore → Adapter → Director → Board
```

---

## Shared package layout

```
packages/shared/src/{game}/
├── types.ts       # phases, state, actions, rules options, *ClientGameState
├── game.ts        # create / deal / apply* / completeRound / startNewRound
├── rules helpers  # trick.ts, bidding.ts, play.ts, scoring.ts as needed
├── ai.ts          # easy policy
├── ai-hard.ts     # optional hard policy (+ tracker class)
├── remarks.ts     # detectEvents + createXRemarkEngine()
├── tests/         # pure + golden sequence tests
└── index.ts
```

Spades is exported as `export * as Spades` (namespace avoids collisions). Other games may be flat or namespaced; pure entry points must be documented.

---

## Pure game contract

```ts
// Conceptual shape — names may vary per game

interface GameRules { /* stickTheDealer, winScore, superTwos, … */ }

// Full authoritative state (all hands). Never send raw to clients.
interface GameState { /* … */ rules: GameRules }

type Action =
  | { type: 'bid'; /* … */ }
  | { type: 'play'; /* … */ }
  | { type: 'pass' }
  | { type: 'discard'; /* … */ }

createGame(config): GameState
deal / startRound(state, rng?): GameState
applyAction(state, playerId, action): GameState
// or convenience reducers: processBid, playCard, processPass, …
legalActions(state, playerId): Action[]  // or getLegalCards + valid action list
```

### Rules of pure code

1. No `setTimeout`, WebSocket, DOM, or remarks side effects.
2. No reading global settings stores — rules live on `state.rules` (or explicit args).
3. Shuffle/deal accept optional injected `rng` (default `Math.random`) for tests and future sim.
4. AI choosers are pure decision functions; hosts call them and feed `applyAction`.

### Illegal-action / same-reference contract

- **Illegal** (wrong phase, not your turn, illegal card, etc.): return the **same state reference** (`next === prev`).
- Hosts detect rejection without a parallel validation path:

```ts
const next = processBid(state, seat, bid)
if (next === state) return false  // rejected at transport
this.state = next
```

- **Legal actions must always return a new state object**, even if the change is small. Same-ref means *rejected*, not “legal no-op.”  
  Card games satisfy this naturally (hands/piles change). A future “acknowledge” / “ready” that changes nothing must still produce a new object (e.g. set a flag) or use a different host protocol. **Do not** invent legal actions that return the same reference.

---

## Host responsibilities

| Concern | Client SP store | Server `*Game` |
|---|---|---|
| Hold state | Apply pure results into refs | Prefer one `private state: GameState` (+ seat metadata: odusId, avatar, disconnected) |
| Transitions | `state = apply*(…)` only | hold → pure → assign only |
| Animation | Director callbacks / delays | Timeouts before next AI / next-trick emit |
| AI schedule | Think delay → choose → apply | Same |
| Remarks | After apply | After apply |
| Multiplayer | N/A | Filter hands, **stateSeq**, reminders, boot/disconnect, **queued-command stateSeq re-check**, **reconnect matching** |
| Settings | Copy into `state.rules` at start | Copy from **table settings** at start |

---

## Wire-format freeze (OTA)

Client ships via Capgo OTA; server deploys separately. During rollout, old client bundles talk to new servers.

**Server refactors must not change:**

- Filtered `*ClientGameState` field shapes as currently on the wire (unless additive and deliberately versioned)
- Existing `ServerMessage` / `ClientMessage` payloads

Internal pure-state reshaping is fine. The **projection** layer (`state.ts` builders) is the compatibility boundary.

**Additive** protocol (e.g. new optional table-setting fields) is allowed when old clients ignore them and server defaults preserve prior behavior.

Preserve multiplayer hardening:

- stateSeq re-check on queued commands
- reconnect-matching behavior

---

## Product rules (SP = MP)

Hosts must not silently diverge. Examples:

| Game | Rule |
|---|---|
| Spades | Normal bid **1–13**; nil / blind nil are separate bid types |
| Spades | Bags stored **`% 10`** (remark engine may detect bag penalty via shrink) |
| Spades | Blind nil uses a **pure pre-look phase/flag** — not scorable after the hand was shown |
| Euchre | Stick-the-dealer / Canadian loner live in `state.rules`; MP needs table settings (President pattern) |
| Euchre | R2 all-pass with “can pass” → **redeal** (rotate dealer) |
| President | `passedThisTrick` must survive server build/apply for turn styles |

---

## Testing

### Golden fixture format (shared-level primary)

```ts
{
  initialState: /* post-deal preferred: explicit hands */,
  rules: { … },
  actions: [{ seat, action }, …],
  expect: { scores, winner, terminalPhase }
}
```

| Level | Acceptance gate? |
|---|---|
| Shared pure goldens | **Yes** |
| Server `*Game` goldens (Node) | **Yes** where feasible |
| SP Pinia store goldens | **No** (timers/animation; optional only) |
| Playwright | UX only — not rules correctness |

---

## New multiplayer game checklist

1. [ ] `types.ts` — phases, state, actions, rules, `*ClientGameState`
2. [ ] `game.ts` — pure create / deal / apply* / legalActions (same-ref reject; legal → new object)
3. [ ] Unit + golden tests with deterministic hands
4. [ ] `ai.ts` (+ optional `ai-hard.ts`)
5. [ ] `remarks.ts` + bot categories if needed
6. [ ] Server thin host: apply pure, project client state, AI schedule, disconnect, stateSeq
7. [ ] Table settings → `state.rules` if the game has variants
8. [ ] Client SP store: apply + animation only
9. [ ] Client MP: store + adapter + director + board
10. [ ] Wire messages in multiplayer protocol; OTA-safe defaults
11. [ ] Update `docs/NEW_GAME_GUIDE.md` examples if patterns change

**Reference implementation:** `packages/shared/src/spades/` and client `spadesStore.ts` apply pattern.  
**Server apply reference:** President play/pass path (`build → processPlay → apply`).

---

## Anti-patterns

- Duplicating phase machines in both SP store and server class (Euchre legacy)
- Server reimplementing bid/play mutably while shared has pure functions (Spades server pre-migration)
- Dropping pure-state fields in `buildXGameState` (e.g. empty `passedThisTrick`)
- Reading `settingsStore` from shared
- Changing wire `ClientGameState` shape “because pure state looks different”
- Legal no-op actions that return the same state reference

---

## Migration status

See `docs/designs/pure-game-architecture-plan.md` for phased work:

| Game | Shared pure machine | Client applies pure | Server applies pure |
|---|---|---|---|
| Spades | Yes (+ blind-nil `handRevealed`, bid 1–13) | Yes (double-deal fixed) | Bid + play apply pure (`processBid` / `playCard` / `continuePlay`); host is thin shell |
| President | Partial (exchange) | Mostly | Play/pass yes; exchange no |
| Euchre | No (`game.ts` pending) | No | Partial (R2 all-pass → unconditional redeal) |

See `docs/designs/pure-game-architecture-plan.md` for remaining phases.
