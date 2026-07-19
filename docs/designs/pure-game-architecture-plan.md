# Align Games to Pure State-Machine Architecture

**Status:** Ready to execute (signed off after Claude review + second-pass refinements)  
**Branch style:** Per-phase PRs to main (not one long-lived branch)  
**Goal before adding new games:** Spades as pristine template; then Euchre + President aligned; docs say “copy Spades”  
**Review note:** Claude verified load-bearing claims, signed off on structure, then refined Phase 0.5 wording, blind-nil resolution, and same-ref invariant.

---

## Goal

Make every multiplayer game follow one pristine structure before adding new games:

1. **Shared owns rules progression** — pure `(state, action) → state` transitions.
2. **Hosts stay thin** — client store = apply + animation/AI scheduling; server class = apply + multiplayer shell (WS, privacy, reminders, disconnect).
3. **One behavior SP and MP** — no silent rule forks.
4. **Spades becomes the gold-standard template first**; Euchre and President migrate to match; docs tell new-game authors to copy Spades.

**Delivery:** ship **one PR per phase** to `main`. Phases are independently shippable (Spades work cannot break Euchre). A long-lived mega-branch only drifts against active fixes on main; this repo releases from main via `npm run release`.

**Out of scope:** trained AIs / sim harness (benefits later); Klondike full rewrite; visual/animation redesign; shared server host base class (revisit only in Phase 5 if commonality is obvious after all three games use apply).

---

## Background: why this cleanup

Euchre was first and used **structure A**: pure *kernels* in shared (trick, bid→trump, score), with the full phase machine implemented twice (client store + server class).

Spades/President introduced **structure B**: pure full-game transitions in `shared/.../game.ts`. Clients largely apply those results. Servers still vary:

| Layer | Spades | President | Euchre |
|---|---|---|---|
| Pure full game transitions in shared | Yes (`game.ts` / `tricks.ts`) | Yes (play/pass strong; exchange incomplete) | **No** — kernels only (no `game.ts`) |
| Client SP applies pure results | Yes | Mostly (play path) | **No** — store *is* the phase machine |
| Server applies pure results for main actions | **No** — reimplements bid/play mutably; `buildSpadesGameState` used mainly for remarks | Yes for play/pass | **No** — reimplements full phase machine |
| Known SP↔MP rule gaps | Bid: `isValidBid` requires **1–13**, `processBid` allows **0**; SP double-deal on next round | `passedThisTrick: []` hardcoded on server build → pass-lockout broken in MP | Stick-the-dealer / Canadian loner diverge; **R2 all-pass hangs on server** |

Docs say “Spades is cleanest,” but the **server** never fully adopted Spades’ pure API. Gold standard:

- **Spades shared + Spades client `applyState`** for API design
- **President’s `buildState → pure → applyState`** for multiplayer hosts
- Combined = target for all games

**Spades-first (not shared host base class first):** correct. The three server shells differ in real ways (President exchange, Euchre sit-out). Abstracting before all three are on apply means abstracting from one example. Extract shared host helpers only in Phase 5 if obvious.

---

## Hard constraints (from review)

### Wire-format freeze (OTA / version skew)

Client ships via Capgo OTA; server deploys separately. Old client bundles will talk to rewritten servers during rollout.

**Phases 1B / 3D / 4A must not change:**

- Filtered client-state shape (`*ClientGameState` and nested player fields as currently on the wire)
- Any `ServerMessage` / `ClientMessage` payloads in multiplayer protocol

Internal pure-state reshaping is fine. Projection layer (`state.ts` builders) is the compatibility boundary.

### Preserve recent multiplayer hardening

Server rewrites must **not** steamroll:

- **stateSeq re-check on queued commands** (#66)
- **reconnect-matching fix** (#67)

Add both to every server-phase acceptance checklist.

### Illegal-action contract

Pure transitions return state unchanged on illegal actions.

**Detectability rule:** because transitions are immutable, **`next === prev` (same reference) means rejected**. Hosts use:

```ts
const next = processBid(state, seat, bid)
if (next === state) return false  // rejected at transport
// else apply next
```

Keeps `makeBid(): boolean` / reminder/boot logic without a parallel validation path.

**Invariant (must document in `GAME_ARCHITECTURE.md`):** every **legal** action must return a **new** state object — even if the semantic change is tiny. Same-ref rejection only works if no legal action is a pure no-op. Card games satisfy this naturally (hands/piles always change). A future “acknowledge” / “ready” action that changes nothing would falsely read as rejected; such actions must still produce a new object (e.g. bump a generation field, set a ready flag) or use a different host protocol.

---

## Target Architecture (canonical)

### Shared package layout (per multiplayer game)

```
packages/shared/src/{game}/
├── types.ts       # phases, state, actions, rules options, client projection types
├── game.ts        # create / deal / apply* transitions / completeRound / startNewRound
├── rules helpers  # trick.ts, bidding.ts, play.ts, scoring.ts as needed
├── ai.ts          # easy policy
├── ai-hard.ts     # optional hard policy + tracker (host-owned tracker instance)
├── remarks.ts     # detectEvents + createXRemarkEngine()
├── tests/         # pure transition + golden sequence tests
└── index.ts
```

### Pure game contract

```ts
// Conceptual — names may vary per game but shape must match

type GameRules = { /* stickTheDealer, winScore, superTwos, ... */ }

// Full authoritative state (all hands visible) — never send raw to clients
interface GameState { /* ... */ rules: GameRules }

type Action =
  | { type: 'bid'; ... }
  | { type: 'play'; ... }
  | { type: 'pass'; ... }
  | { type: 'discard'; ... }

createGame(config): GameState
deal / startRound(state, rng?): GameState
applyAction(state, playerId, action): GameState  // same ref => rejected; legal => new object
legalActions(state, playerId): Action[]
```

**Rules of pure code:**

- No `setTimeout`, WebSocket, DOM, remarks side effects.
- No global settings stores — rules on state (or args).
- Shuffle/deal: optional injected `rng` (default `Math.random`) for tests/sim.
- Illegal → return **same state reference**; hosts detect with `next === prev`.
- **Legal → always a new object** (no legal no-ops that return the same ref).
- AI choosers pure; hosts call them and feed apply.

### Host responsibilities

| Concern | Client singleplayer store | Server `*Game` class |
|---|---|---|
| Hold state | apply pure results into refs | Prefer **one** `private state: GameState` (+ seat metadata: odusId, avatars, disconnected) |
| Transitions | `state = apply*(…)` only | hold/build → pure → assign only |
| Animation / director | awaits, delays local UI | timeouts before next AI / next-trick emit |
| AI schedule | think delay → choose → apply | same |
| Remarks | after apply | after apply |
| Multiplayer | N/A | filter hands, **stateSeq**, reminders, boot/disconnect, events, **queued-command stateSeq re-check**, **reconnect matching** |
| Settings | copy into `state.rules` at start | copy from table settings at start |

### Client multiplayer (unchanged layering)

```
MultiplayerStore → Adapter → Director → Board
```

Server-authoritative. Pure helpers only for local legal-card highlights.

### Namespace

Keep `export * as Spades`. Namespaced `Euchre.*` / `President.*` optional late cleanup — not required for pristine template.

---

## Product rule unifications

| Issue | Unified behavior |
|---|---|
| Euchre stick-the-dealer | Enabled: dealer in R2 with 3 passes **must** call. Disabled: R2 all-pass **redeals**. Same SP + MP. |
| Euchre Canadian loner | Enabled: ordering partner’s turn-up **forces** alone. In pure `applyBid`, not UI-only. |
| **Spades normal bid range** | **Tighten `processBid` to 1–13** to match `isValidBid`. A “normal 0” is not a standard bid (nil is the 0 path). Do **not** loosen server to 0–13. |
| President turn styles | `passedThisTrick` always preserved on server build/apply. |
| President game length | Shared `checkGameOver` (or one constant) on both hosts. |
| President joker clear | Pure play transition (or pure helper both hosts call). |
| President exchange | **Pure simultaneous model** (pending confirmations on state). SP sequential UI submits same confirm actions in order. No documented host exception. |

---

## Pure-state fields / lifecycle edges (must not drop)

### Spades

| Item | Rule |
|---|---|
| **Bags representation** | Bags stored **`% 10`**. Remark engine detects `bag_penalty` when bags shrink. Preserve representation **or** update remarks detection in the **same commit**. |
| **Blind nil** | **Resolved: pure phase/flag.** SP holds `blindNilDecisionPending` as host state today. Server already **scores** `SpadesBidType.BlindNil` but has no pre-look gate — hands are dealt/broadcast before bidding, so MP blind nil is half-implemented and unenforceable (a “blind” bid can arrive after cards were shown). A pure decision phase/flag is not just a future feature: it **fixes an existing inconsistency**. Phase 1 implements it in shared; SP + MP both enforce “no hand look before blind decision.” |
| Bid validation | Single path: normal **1–13**, nil/blind nil separate. |

### Euchre

| Item | Rule |
|---|---|
| `passCount` | On pure state |
| `rules: { stickTheDealer, canadianLoner }` | On pure state |
| **`biddingStartPlayer`** (or equivalent) | On pure state so R1/R2 advance/redeal are host-independent |
| **Dealer pickup when sitting out** | Encode in pure `applyBid` (server today: sit-out skip at pickup — `EuchreGame.ts` ~337), not left to hosts |
| Alone sit-out during play | Pure advance-seat skips partner |

### Host-owned (correctly stay out of pure)

Disconnect/boot mid-trick, WS, timers, remarks cooldown instances, hand privacy projection, animation.

---

## Phase 0.5 — Hotfix on main (before / parallel to refactor)

**Euchre MP R2 all-pass hang:** `EuchreGame.ts` ~362–364 only advances `currentPlayer` forever; client redeals (`euchreGameStore` ~336–341). With AI, someone eventually calls; **four humans passing twice hangs the game**.

**Hotfix behavior: unconditional redeal on R2 all-pass** (match SP default “Dealer Can Pass”).

Do **not** say “redeal or stick per settings” for this hotfix — **the server has no Euchre table settings at all**. `EuchreGame.ts` has zero references to `stickTheDealer` / dealer-pass rules (unlike President, which already carries `superTwosMode` / `turnStyle` on the server). Stick-the-dealer cannot exist in MP until Phase 3 adds a settings path.

**Hidden Phase 3 work item (must call out in 3D):** add a **table-settings mechanism for Euchre tables** (follow President’s pattern) so `stickTheDealer` and `canadianLoner` can be set at table create and flow into pure `state.rules`. Without that, Phase 3 rule unification only works for SP.

- Ship this small redeal hotfix on main **before or as fast-follow before Phase 3**.
- Prefer landing hotfix first so production is safe while Spades Phase 1 lands.

---

## Phase plan

### Phase 0 — Architecture contract

**Deliverables:**

- `docs/GAME_ARCHITECTURE.md` — pure contract, host do/don’t, **illegal = same ref**, **legal = new object invariant**, **wire-format freeze**, new-game checklist.
- Update `docs/DOCUMENTATION_INDEX.md`.
- List known divergences with unified behaviors (this doc’s tables).

**PR:** docs-only, zero runtime risk.

---

### Phase 1 — Spades as pristine template

**1A. Shared purity fixes**

- **Tighten `processBid` normal bids to 1–13** (match `isValidBid`); tests for reject of normal-0.
- Ensure `playCard` / `continuePlay` / `completeRound` / `startNewRound` is the only scoring path.
- Preserve bags `% 10` (or update remarks same commit).
- **Blind nil: pure phase/flag** — enforce pre-look decision before hands are visible for bidding; SP + server + client projection; scores already support `BlindNil`.
- Optional `rng` on deal for tests.
- Expand pure tests + **golden sequences** (format below).

**1B. Server `SpadesGame` → apply pattern**

**Sub-task (budget explicitly):** migrate toward **one internal `SpadesGameState`** (+ seat metadata map). This rewrites every place the server reads individual fields for broadcast/remarks — not a soft preference.

- Transitions only:

  ```ts
  const next = Spades.processBid(this.state, seat, bid)
  if (next === this.state) return false
  this.state = next
  // broadcast from projection(this.state)
  ```

- Delete duplicated mutable bid/play/AI-play paths.
- Wire hard AI to table difficulty.
- Fix human vs AI next-trick pause constants.
- **Preserve stateSeq queued re-check (#66) and reconnect matching (#67).**
- **Wire-format freeze:** projection output unchanged.

**1C. Client store cleanup**

- Fix double-deal: `startNewRound` already deals — do not call `startRound` deal again (`spadesStore` ~286–289).
- Thin `applyState` only; no local phase math.
- Align remark flags with shared detection where possible.

**1D. Acceptance**

- [ ] No bid/play transition logic in `SpadesGame.ts` except apply + shell.
- [ ] Shared goldens: same action sequences → same scores (pure path).
- [ ] Server goldens: real `SpadesGame` class driven with scripted actions (plain Node).
- [ ] SP-store goldens **not** an acceptance gate (Pinia + timers; optional only).
- [ ] Bags still `% 10` and bag remarks still fire (or detection updated same PR).
- [ ] Blind nil: pure pre-look phase enforced SP + MP (cannot score blind nil after hand was shown).
- [ ] Wire client-state shape: additive blind-nil phase fields only if needed for enforcement; document OTA; #66 / #67 still work.
- [ ] Manual smoke SP + MP Spades.

**After Phase 1:** Spades is the template. Structure supports starting a new game, but **prefer landing Phase 3 rule unifications (esp. Euchre R2 hang if not hotfixed) before queueing new games**, or user-facing Euchre bugs stay buried.

---

### Phase 2 — Docs as template

- `docs/NEW_GAME_GUIDE.md` — `game.ts` required; build/apply server required; Spades as checklist; wire-format and illegal-ref contract.
- `docs/LLM_ONBOARDING.md` — shared owns rules.
- `CLAUDE.md` (filename is **`CLAUDE.md`**, not `Claude.md`) — pure game ownership norms.

**PR:** docs-only.

---

### Phase 3 — Euchre: extract `game.ts` + thin hosts

**Prerequisite:** Phase 0.5 hotfix on main for R2 all-pass (if not already shipped).

**3A. Shared `packages/shared/src/euchre/game.ts`**

| Function | Owns |
|---|---|
| `createEuchreGame` | players, scores, Setup, rules |
| `dealRound` | shuffle/deal, kitty, turn-up, passCount=0, biddingStartPlayer |
| `applyBid` | passes, R1→R2, stick vs redeal, trump, alone, **Canadian loner**, **dealer pickup / sit-out skip**, → DealerDiscard or Playing |
| `applyDealerDiscard` | remove card → Playing + lead (sit-out skip) |
| `applyPlay` | legality, hand, trick, advance / complete |
| `continueAfterTrick` | next trick or completeRound |
| `completeRound` | score, GameOver vs rotate dealer |
| `legalActions` / `getLegalCards` | stick-dealer constraints included |

**Pure state includes:** existing fields + `passCount`, `rules`, `biddingStartPlayer` (or equivalent), consistent dealer identity.

**3B.** Unify product rules (stick-the-dealer, Canadian loner) in pure `applyBid` once rules exist on state.

**3C.** Client `euchreGameStore` — apply pure state; hard bid AI parity; animation/remarks/tracker stay host-owned.

**3D. Server `EuchreGame` + Euchre table settings (explicit scope)**

- build → pure apply → assign; delete duplicate phase machines.
- **Add Euchre table-settings plumbing** (President-style): table create / lobby settings carry `stickTheDealer` and `canadianLoner` into `EuchreGame` constructor → `state.rules`. Without this, stick-the-dealer and Canadian loner remain SP-only after pure extraction.
- Projection / turns call pure `legalActions`.
- Preserve #66 / #67; wire-format freeze for existing fields. New optional settings fields on table create are additive protocol — document carefully for OTA (old clients ignore new settings; server defaults to can-pass / loner-off to match prior MP behavior).

**3E. Types:** defer `core` `EuchreCard` migration if it expands diff.

**3F. Acceptance**

- [ ] Goldens shared + server for stick-the-dealer and can-pass (incl. R2 all-pass redeal).
- [ ] No infinite R2 pass loop on server.
- [ ] Euchre table settings flow SP rules into MP when host enables them; defaults preserve prior MP behavior.
- [ ] Wire format freeze for game-state projection; #66 / #67 preserved.
- [ ] Manual smoke SP + MP.

---

### Phase 4 — President

**4A.**

- Preserve `passedThisTrick` on build/apply (fix silent MP turn-style break).
- Joker clear in pure path.
- Shared game-over constant / `checkGameOver`.
- Server uses shared `startNewRound` where possible.
- Wire freeze; #66 / #67.

**4B. Card exchange — pure simultaneous model (decided)**

- Pending confirmations on pure state; apply swap when all required seats confirmed.
- SP sequential UI = host submitting the same confirm actions in order.
- Remove dual SP/MP exchange implementations over time.

**4C. Acceptance**

- turnStyle works on server; joker clear SP=MP; exchange hand ownership golden.

---

### Phase 5 — Cross-game polish

- Shared golden runner utility if not already in Phase 1.
- Optional extract tiny shared server helpers **only if** duplication is obvious after 1–4.
- Hard-AI parity audit.
- Grep: no phase mutation outside apply.
- Update `CLAUDE.md` if needed.

---

## Testing strategy

### Golden fixture format (shared-level primary)

```ts
{
  initialState: /* post-deal, explicit hands — prefer explicit over seeded-rng */,
  rules: { ... },
  actions: [{ seat, action }, ...],
  expect: { scores, winner, terminalPhase }
}
```

| Level | Gate? | Notes |
|---|---|---|
| Shared pure goldens | **Yes** | Run fixture through pure transitions |
| Server class goldens | **Yes** | Drive real `*Game` in Node with same fixtures where applicable |
| SP Pinia store goldens | **No** | Fake timers + deal-anim stubs; optional only if thin apply path |
| Manual SP/MP smoke | **Yes** | Per game after its phase |
| Playwright | No for rules | UX only |

---

## Risk management

| Risk | Mitigation |
|---|---|
| OTA client / new server skew | Wire-format freeze on every server PR |
| Steamrolling #66 / #67 | Explicit acceptance checks |
| Behavior surprises | Product unifications documented; release notes |
| Branch drift | **Per-phase PRs to main**, not one mega-branch |
| Bags/remarks break | Preserve `% 10` or update detection same commit |
| Euchre MP hang | Phase 0.5 **unconditional redeal** hotfix before Phase 3 |
| Stick-the-dealer still SP-only after pure Euchre | Phase **3D table-settings** for Euchre (President pattern) |
| Legal no-op false reject | Contract: legal actions always return new object |
| Single-state server rewrite cost | Budget Phase 1B as full sub-task |
| President exchange size | Pure simultaneous; isolate commits inside Phase 4 |

---

## Branch / PR workflow

```text
main
  ├─ PR: Phase 0.5  Euchre R2 all-pass → unconditional redeal (small, ASAP)
  ├─ PR: Phase 0    GAME_ARCHITECTURE.md
  ├─ PR: Phase 1    Spades pristine
  ├─ PR: Phase 2    NEW_GAME_GUIDE + CLAUDE.md + onboarding
  ├─ PR: Phase 3    Euchre game.ts + hosts
  ├─ PR: Phase 4    President purity + pure exchange
  └─ PR: Phase 5    polish / optional host helpers
```

If intermediate work must sit on a branch, **merge main after every phase** before continuing.

---

## Success criteria

1. Spades is the reference: pure transitions, both hosts only apply, docs point at Spades.
2. Euchre has `shared/euchre/game.ts`; **shared owns the phase graph; store and server only apply.**
3. President has no pure-field drops; exchange is pure simultaneous.
4. SP and MP same rule outcomes for same actions + rules.
5. Wire format stable across server rewrites; #66 / #67 intact.
6. New multiplayer game = checklist against `GAME_ARCHITECTURE.md` + Spades tree.

---

## First concrete steps (execution order)

1. **Hotfix:** Euchre server R2 all-pass → **unconditional redeal** on main.
2. Write `docs/GAME_ARCHITECTURE.md` (contract + same-ref reject + legal-must-be-new-object + wire freeze).
3. Spades shared: tighten `processBid` to 1–13; blind-nil pure phase; golden tests.
4. Spades client: fix double-deal; consume blind-nil pure phase.
5. Spades server: single-state (or complete apply) + delete mutable bid/play; blind-nil gate; preserve #66/#67.
6. Docs PR; then Euchre pure extraction **including table settings**; then President.

---

## Key files

### Spades
- `packages/shared/src/spades/game.ts`, `tricks.ts`, `bidding.ts` (`isValidBid` ~line 14; `processBid` ~142)
- `packages/client/src/games/spades/spadesStore.ts` (double-deal ~286–289)
- `packages/server/src/games/spades/SpadesGame.ts` (mutable `makeBid` ~313–339)
- `packages/server/src/games/spades/state.ts`

### President
- `packages/shared/src/president/game.ts`, `play.ts`
- `packages/server/src/games/president/state.ts` (`passedThisTrick: []` ~119)
- `packages/server/src/games/president/cardExchange.ts`

### Euchre
- `packages/shared/src/euchre/` — kernels only
- `packages/client/src/games/euchre/euchreGameStore.ts` (R2 redeal ~336–341)
- `packages/server/src/games/euchre/EuchreGame.ts` (R2 advance-only ~362–364; sit-out pickup ~337)

### Docs
- `docs/NEW_GAME_GUIDE.md`, `docs/LLM_ONBOARDING.md`, `docs/DOCUMENTATION_INDEX.md`, **`CLAUDE.md`**

---

## Resolved decisions (post-Claude)

| # | Question | Decision |
|---|---|---|
| 1 | Spades-first vs host base class | **Spades-first**; host base only Phase 5 if obvious |
| 2 | Spades bid 0–13 vs 1–13 | **Tighten to 1–13** (normal bids); nil is the zero path |
| 3 | President exchange | **Pure simultaneous** model |
| 4 | Branch style | **Per-phase PRs to main** |
| 5 | Pause after Phase 1 for new game | Structure allows it; **prefer Phase 0.5 + Phase 3 rule fixes before new games** so Euchre hangs/divergences don’t sink |
| 6 | Illegal actions | Same-ref rejection; **legal actions always return a new object** |
| 7 | SP store goldens | Not an acceptance gate |
| 8 | Euchre types to core | Defer if risky |
| 9 | Namespaces for all games | Optional late |
| 10 | Phase 0.5 R2 all-pass | **Unconditional redeal** (server has no Euchre settings yet) |
| 11 | Blind nil | **Pure phase/flag** in Phase 1 (fixes unenforceable MP scoring path) |
| 12 | Stick-the-dealer in MP | Requires **Phase 3D Euchre table-settings** (President pattern); not in Phase 0.5 |

---

## Claude review incorporation checklist

- [x] Spades-first affirmed; no premature host base class
- [x] Euchre R2 all-pass hang → Phase 0.5 **unconditional redeal** hotfix
- [x] Phase 3D: Euchre table-settings for stick-the-dealer / Canadian loner in MP
- [x] Spades bid unification flipped to 1–13
- [x] Wire-format freeze under OTA
- [x] #66 / #67 in acceptance
- [x] Bags `% 10` preserved
- [x] Blind nil → pure phase/flag (resolved, not deferred)
- [x] Euchre `biddingStartPlayer` + dealer-pickup sit-out in pure
- [x] Illegal = same reference; legal = new object invariant
- [x] Per-phase PRs
- [x] Golden format + SP goldens not gated
- [x] President exchange option 1
- [x] `CLAUDE.md` filename
- [x] Phase 1B single-state budgeted as real sub-task
- [x] Nits: “steamrolling”; success criterion 2 wording
