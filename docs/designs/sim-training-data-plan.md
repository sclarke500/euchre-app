# Simulation & Training-Data Plan

**Status:** §14 implemented (E3 Euchre legalActions + packages/sim multi-policy dump). E1/E2/S2+ still open.  
**Repo:** this monorepo (`packages/sim` + pure engines in `@67cards/shared`)  
**Depends on:** pure game architecture (Euchre / Spades / President state machines)  
**Non-goal (v1):** Python training loop, ONNX export, shipping Expert difficulty  

---

## 1. Purpose

Generate **headless, seeded, multi-policy** self-play trajectories from the **same pure rules** the product uses, so we can:

1. Benchmark policy strength (win rates, score distributions).  
2. Build datasets for imitation learning and later self-play RL.  
3. Avoid dual rule implementations (no Python reimplementation of Euchre/Spades/President).

Sim is **TypeScript**. Training (when we get there) may be Python and only **consumes** sim output.

---

## 2. Design principles

| Principle | Meaning |
|---|---|
| Shared is truth | Runners only call pure `apply*` / `process*` from `@67cards/shared` |
| Imperfect info in **dataset** | Recorded observations never include opponent private cards |
| Seeded | Same seed + same policy map → reproducible deal + actions |
| Multi-policy | Seats can run different policies in one game |
| Legal-only | Actions always chosen from per-phase `legalActions`; illegal apply aborts or fallback |
| Privileged built-in policies | Product easy/hard AIs may see full pure state (as in product); **leakage is enforced on what we write**, not by starving the teacher |
| No product chrome | No Vue, WS, timers, remarks, timeouts |

---

## 3. Engine prerequisites (shared package — not free)

These are **blockers** for S2/S3 (and for reproducibility claims). Do not assume they already work.

### 3.1 Seeded deal / shuffle (today: Euchre only)

| Engine | Status |
|---|---|
| Euchre | `dealRound(state, rng)` injects RNG; OK for S1 |
| Spades | `core/deck.ts` `shuffleDeck` hardcodes `Math.random`; `createSpadesGame` random dealer uses raw `Math.random` |
| President | Same shared `shuffleDeck` / deal path |

**Work item E1:** Thread optional `rng: () => number` through:

- `packages/shared/src/core/deck.ts` (`shuffleDeck`, deal helpers)  
- Spades: `createSpadesGame` / `dealSpadesCards` (dealer + shuffle)  
- President: `dealPresidentCards` / `startNewRound` deal path  

Default remains `Math.random` for product; sim always injects seeded RNG.

### 3.2 Seeded stochastic easy AIs (today: Euchre clean; Spades/President not)

| Engine | Status |
|---|---|
| Euchre easy/hard | Deterministic (given state + tracker) |
| Spades easy | Stochastic nil roll (`Math.random() < 0.3`) and bid variance |
| President easy | ~10% random pass |

**Work item E2:** Inject optional `rng` into Spades/President easy AI choosers (keep stochasticity — useful for coverage; must be seedable).  
Hard AIs stay deterministic given state + per-instance tracker.

Without E2, **reproducibility fails** for Spades/President even with seeded deals.

### 3.3 Per-phase legal-action enumerators

Today, only **card play** has clean enumerators (`getLegalCards` / `getLegalPlays` / `findValidPlays`). Missing for:

| Phase | Needs |
|---|---|
| Euchre R1 bid | Pass / OrderUp / PickUp (+ alone flags as distinct actions) |
| Euchre R2 bid | Pass / CallTrump(suit) / alone; stick-the-dealer may forbid Pass |
| Euchre dealer discard | Any card in hand |
| Spades bid | Normal 1–13, Nil, BlindNil (rules/blind-nil phase aware) |
| President | Pass legality + multi-card legal plays (partially covered) |

**Work item E3:** Add pure `legalActions(state, seat): Action[]` (or game-specific helpers) per phase in shared.  
This is **real S1/S2 work**, and S4 “legal membership” validation depends on it.

### 3.4 Euchre hard tracker: no module-global singleton

`getTracker()` in `euchre/ai-hard.ts` is a **module-global** singleton (same class of bug as the old remark-engine cooldown).

`chooseCardToPlayHard` already accepts a tracker parameter.

**Work item E4 (sim + discipline):** Each hard-policy seat constructs its **own** `GameTracker` instance (and Spades `SpadesTracker` when needed). **Never** call `getTracker()` from sim.  
Document in runner requirements (§8) so four hard seats don’t cross-contaminate void inference.

### 3.5 Leakage audit (verified good)

Hard AIs were grepped: they do **not** read opponent hands; nil attack uses public void inference (`tracker.isPlayerVoid`). Plan claim holds — keep it that way in sim wrappers.

### 3.6 Prerequisite → phase mapping

| Prerequisite | Blocks |
|---|---|
| E1 Spades/President rng deal | S2, S3 reproducible dumps |
| E2 Spades/President AI rng | S2, S3 reproducibility |
| E3 legal enumerators | S1 complete (Euchre bids/discard), S2/S3, S4 validator |
| E4 per-seat trackers | S1 multi-hard Euchre correctness |

**Euchre S1 can start after E3 (bid/discard enums) + E4 discipline;** full deal seed already exists for Euchre.

---

## 4. Should “hard” be the baseline? (still yes as teacher, no as sole source)

### 4.1 Portfolio

| Policy id | Behavior | Role |
|---|---|---|
| `hard` | Product hard AI (privileged state) | Teacher + ladder |
| `easy` | Product easy AI (seeded stochastic where applicable) | Weaker lines |
| `random_legal` | Uniform over `legalActions` | Coverage |
| `noisy_hard` | ε-greedy over hard (ε roll **owned by wrapper**) | Teacher + exploration |
| `noisy_easy` | ε-greedy over easy | Chaos |

### 4.2 Why not hard-only

Mode collapse, coverage holes, self-play bias, partnership diversity — unchanged from prior draft. Deterministic hard explores **deals** with many seeds but not **actions** under a deal.

### 4.3 Default mix (v1) — keep; don’t raise pure-random above ~10%

| Fraction | Policies (example) | Purpose |
|---|---|---|
| 30% | `hard×4` | Clean teacher self-play |
| 25% | `hard,easy,hard,easy` | Ladder / partnership mismatch |
| 20% | `noisy_hard×4` (ε=0.1) | Hard actions in varied states |
| 15% | mixed hard + easy + random | Weird opponents |
| 10% | `random_legal×4` | Legal coverage (enough; costly Euchre hands) |

10% pure-random is enough for v1; easy to raise later. Random-heavy Euchre produces more redeals/euchres → longer games.

---

## 5. Policy interface (revised)

### 5.1 Two layers

**Built-in product policies (privileged):** may use full pure engine state — same as product SP/server — so sim-hard ≡ product-hard (no obs translation bug poisoning teacher labels).

```ts
interface BuiltinPolicyContext<TState> {
  state: TState           // full pure state
  seat: number
  legal: Action[]
  rng: () => number
  tracker?: unknown       // per-seat GameTracker / SpadesTracker
}

interface BuiltinPolicy<TState> {
  id: PolicyId
  choose(ctx: BuiltinPolicyContext<TState>): { action: Action; exploratory: boolean }
}
```

**Learned policies (future):** observation-only:

```ts
interface LearnedPolicy {
  id: PolicyId
  choose(ctx: {
    observation: Observation
    legal: Action[]
    rng: () => number
  }): { action: Action; exploratory?: boolean }
}
```

**Runner always records** `observation` (imperfect info) + `action` + `policyId` + `exploratory` flag.  
Built-ins **do not** consume the observation for decisions.

### 5.2 Noisy wrapper (ε owned by wrapper)

```ts
function noisy(inner: BuiltinPolicy, epsilon: number): BuiltinPolicy {
  return {
    id: `noisy_${inner.id}`,
    choose(ctx) {
      if (ctx.rng() < epsilon) {
        const action = uniform(ctx.legal, ctx.rng)
        return { action, exploratory: true }
      }
      const r = inner.choose(ctx)
      return { action: r.action, exploratory: false }
    },
  }
}
```

Runner sets `labelQuality`:

- `exploratory === true` → `noise`  
- `policyId === hard` or (`noisy_hard` && !exploratory) → `teacher`  
- `easy` / `noisy_easy` non-ε → `exploratory` (not supervised v1)  
- pure `random_legal` → `noise`  

### 5.3 Why not observation-only for hard

Wrapping `chooseCardToPlayHard` behind obs-only requires reconstructing engine types from a lossy encoding. Missed fields → sim-hard ≠ product-hard → **poisoned teacher labels**. Privilege the built-in; police leakage in **S4 dataset validation**.

---

## 6. Observation schema (dataset)

**Record raw public history**, not tracker-derived features:

| Include | Exclude |
|---|---|
| Own hand | Opponent hands |
| Phase, seat, scores, public bids/trump | Buried kitty (except public turn-up) |
| Current trick/pile, ordered public plays | Private tracker internals |
| Legal action list | — |
| Rules flags active this game | — |

**Do not** bake voids/bowers-remaining into the frozen schema — those are this tracker's inferences; trainers can recompute from raw public history. S4 schema freeze would otherwise bake bugs in forever.

`labelQuality` + `exploratory` + `policyId` on every step.

---

## 7. Trajectory format (resolved)

| Decision | Choice |
|---|---|
| Grain | **Flat step stream**: one JSONL line per step |
| Game identity | `gameId` (or `seed` + `gameIndex`) on every step |
| Flush | Buffer steps **in memory per game**, backfill returns, then write |
| Returns | **`handDelta`** for the hand this step belongs to **and** `finalWinner` / final scores |
| Why both | Race-to-10 / 500: full-game-only credit is a terrible signal for early hands |

Sketch:

```ts
interface Step {
  schemaVersion: 1
  game: GameKind
  gameId: string
  seed: number
  gameIndex: number
  handIndex: number          // 0.. for multi-hand games
  stepIndex: number
  seat: number
  phase: string
  observation: Observation
  legalActions: Action[]
  action: Action
  policyId: PolicyId
  exploratory: boolean
  labelQuality: 'teacher' | 'exploratory' | 'noise'
  // backfilled after hand / game:
  handDelta?: number[]       // per-team or per-seat scoring for this hand
  finalScores?: number[]
  finalWinner?: number | null
}
```

Header line (or sidecar) per run: mix id, ε, rules, shared git hash, schemaVersion.

---

## 8. Runner requirements

1. Seeded deal (after E1 for Spades/President).  
2. Per-seat trackers for hard (never `getTracker()`).  
3. `legal = legalActions(state, seat)` (after E3).  
4. `policy.choose({ state, seat, legal, rng, tracker })`.  
5. Record obs via encoder (public only).  
6. Pure apply; same-ref → error / **retry random legal once**. If that fallback path records a step, set `labelQuality: 'noise'` and `exploratory: true` **even when the seat’s policy is hard** — otherwise a buggy enumerator could inject mislabeled teacher steps. Count these in the S4 reject / fallback rate.  
7. On hand end: fill `handDelta`; on game end: fill finals; flush JSONL.  

**Euchre first** — only engine with seedable deal today + deterministic hard/easy.

---

## 9. Package layout

```text
packages/sim/
  src/
    cli.ts
    types.ts
    rng.ts
    policies/          # wrappers around shared AI; per-seat trackers
    legal/             # or re-export shared legalActions once E3 lands
    runners/
    encode/            # observation only (for recording)
    write/jsonl.ts
    report/summary.ts
  README.md
```

CLI:

```bash
npm run sim -- euchre --games 100000 --mix default --seed 42 --epsilon 0.1 --out data/euchre.jsonl --report
npm run sim -- euchre --policies hard,easy,hard,easy --report
```

---

## 10. Phased delivery (updated)

### E0 — Shared engine prerequisites (can parallelize with S0)

| ID | Task | Needed for |
|---|---|---|
| E1 | Thread rng through Spades/President deal | S2, S3 |
| E2 | Seed Spades/President easy AI RNG | S2, S3 |
| E3 | Per-phase `legalActions` (start with Euchre) | S1+ |
| E4 | Document / enforce per-seat trackers in sim | S1 multi-hard |

### S0 — Scaffold

- `packages/sim` workspace, CLI, seeded RNG, JSONL writer  
- Smoke 100 Euchre hard-only  

### S1 — Euchre multi-policy sim

- Depends on: **E3 (Euchre bid/discard enums)**, E4  
- Policies: hard, easy, random_legal, noisy_*  
- Privileged built-in path + obs recording  
- Default mix §4.3  
- Report: win rates, alone rate, points/hand  
- **Milestone:** 10k–100k games dump  

### S2 — Spades

- Depends on: **E1, E2, E3 (Spades bids)**  
- Blind-nil v1: AI always reveal then bid  

### S3 — President

- Depends on: **E1, E2, E3 (pass/play)**  
- Pure exchange auto-confirm for all AI  

### S4 — Dataset hygiene

- schemaVersion freeze  
- Validate: no private cards in obs, action ∈ legal, reject rate  
- Train/val by seed ranges  
- Throughput notes  

### S5 — Training handoff (later)

- Schema doc + Python consumer sample  
- IL on `labelQuality === 'teacher'` only (v1)  
- ONNX path later  

---

## 11. Success criteria

1. Multi-policy sim runs without UI/server.  
2. Hard-only and mixed mixes supported; teacher steps tagged.  
3. Built-in hard in sim matches product hard (privileged state + per-seat tracker).  
4. Recorded obs have no opponent-hand leakage (S4 enforced).  
5. Same seed + mix → same trajectories (after E1/E2 for Spades/President).  
6. Per-hand and final returns present.  

---

## 12. Resolved open questions

| # | Question | Resolution |
|---|---|---|
| 1 | Mix fractions | Keep §4.3; **do not** raise pure-random above ~10% for v1 |
| 2 | Teacher definition | **Include** `noisy_hard` non-ε actions as `teacher` |
| 3 | Trajectory grain | Flat step JSONL + `gameId`; buffer per game for return backfill |
| 4 | Returns | **handDelta + final** scores/winner |
| 5 | First game | **Euchre first** (seedable deal + deterministic AIs today) |
| 6 | ε | **0.1 default**, CLI flag, treat as sweep param |
| 7 | Easy as supervised labels | **No for v1**; tag `exploratory`, door open later |

---

## 13. Explicit non-goals (v1)

- Python inside `packages/sim`  
- Training / model serving  
- Observation-only wrappers for product hard AI  
- Baking tracker-derived features into frozen obs schema  
- Human game logging  
- Klondike  

---

## 14. First implementation slice (when approved)

1. **E3 (Euchre legalActions for bid/discard/play)** in shared.  
2. Scaffold `packages/sim`.  
3. Euchre runner + privileged hard/easy + random_legal + noisy wrapper (ε in wrapper).  
4. Per-seat `GameTracker` for hard seats.  
5. JSONL (flat steps, per-game buffer, handDelta + final).  
6. CLI `--mix default` / `--policies` / `--epsilon` / `--report`.  

**Parallel track:** E1/E2 for Spades/President so S2/S3 don’t stall.

**Done means:** one command dumps mixed-policy Euchre trajectories with teacher tags and prints hard-vs-easy win rate.

---

## 15. Review incorporation checklist

- [x] Seeded deal only Euchre today → E1  
- [x] Spades/President easy stochastic → E2 seed rng  
- [x] Privileged built-in policy interface (not obs-only for hard)  
- [x] noisy ε owned by wrapper; choose returns exploratory flag  
- [x] Per-phase legal enumerators → E3  
- [x] No getTracker() singleton in sim → E4  
- [x] Tracker public-only confirmed  
- [x] Raw public history in obs, not derived voids  
- [x] Mix / teacher / grain / returns / Euchre-first / ε / easy labels resolved  
- [x] Engine prerequisites section so S1/S2 estimates include shared work  
- [x] Stale “runner §7” cross-refs fixed  
- [x] Same-ref fallback steps labeled `noise` (not teacher) + S4 reject rate  
