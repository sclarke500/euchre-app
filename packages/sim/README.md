# @67cards/sim

Headless multi-policy self-play for training data and policy benchmarks.

Uses pure engines from `@67cards/shared` — same rules as product SP/server.

## Quick start

```bash
# From repo root (builds shared first if needed)
npm run build:shared
npm run sim -- euchre --games 100 --mix default --seed 42 --out data/euchre.jsonl --report

# Explicit seat policies
npm run sim -- euchre --games 50 --policies hard,easy,hard,easy --report
```

## CLI

```
npm run sim -- euchre [options]

  --games N          Number of games (default 100)
  --seed N           Master seed (default 42)
  --mix default      Policy mix (§4.3 of sim plan)
  --policies a,b,c,d Per-seat policies (overrides --mix)
  --epsilon E        ε for noisy_* (default 0.1)
  --out PATH         JSONL output path (omit to skip write)
  --report           Print summary to stdout
  --stick-dealer     Enable stick-the-dealer
  --canadian-loner   Enable Canadian loner rule
```

## Policies

| id | Role |
|---|---|
| `hard` | Product hard AI (teacher labels) |
| `easy` | Product easy AI |
| `random_legal` | Uniform over legal actions |
| `noisy_hard` | ε-greedy over hard |
| `noisy_easy` | ε-greedy over easy |

## Output

Flat JSONL: one step per line. Steps buffered per game so `handDelta` / final scores can be backfilled. See `docs/designs/sim-training-data-plan.md`.
