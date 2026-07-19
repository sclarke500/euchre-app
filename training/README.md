# Training spike (S1.5)

Python lives **here**, not in `packages/sim`. Sim dumps JSONL; this package trains and serves a tiny play-card model.

## Setup

```bash
cd training
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Data (default mix — preferred for models that face easy/noise)

Hard×4 self-play is a closed ecosystem; eval vs easy needs teachers facing weak opponents
(plan §4.2). Prefer **default mix** dumps, filter `labelQuality: teacher` (built into play_teacher).

```bash
# Train / val — compact teacher play lines from default multi-policy mix
npm run sim -- euchre --games 5000 --mix default --seed 42 \
  --dump-mode play_teacher \
  --out training/data/euchre-mix-train-5k.jsonl --report

npm run sim -- euchre --games 1000 --mix default --seed 1000042 \
  --dump-mode play_teacher \
  --out training/data/euchre-mix-val-1k.jsonl --report
```

## Train (play-phase teacher only)

```bash
python -m euchre_play.train \
  --train data/euchre-mix-train-5k.jsonl \
  --val data/euchre-mix-val-1k.jsonl \
  --out models/play_mlp_mix_tracker.joblib \
  --hidden 256 --max-iter 60
# --model defaults to mlp
```

Tracker-style features (voids, bowers, trump remaining, partner winning) live in
`euchre_play/features.py`, derived from public history with **left-bower-aware**
effective suits. Not written into the JSONL schema.

`--model` defaults to **mlp** (keep it that way). HGB is optional offline only.

When rolling out with `play_model`, the report prints **hard-fallback rate** (confidence floor → hard AI). High fallback means win rate is partly hard, not pure model.

## Inner-loop metric: action-match (no rollouts)

```bash
python -m euchre_play.action_match \
  --model models/play_mlp_mix.joblib \
  --val data/euchre-mix-val-1k.jsonl
```

Reports **overall**, **forced (1 legal)**, and **contested (2+ legal)** plus lead/follow/trick#.  
**Contested match** is the real signal — overall is inflated by forced plays (~40% of steps).

## Milestone metric: mirrored-deal eval

Euchre win rate is luck-heavy (~33% rule). Compare policies with **mirrored pairs**:
same deal seed, policies rotated +1 (partnerships swap), score the pair.

```bash
# Ceiling: hard vs easy
npm run sim -- euchre --mirror --pairs 1000 --seed 2000042 --report \
  --policies hard,easy,hard,easy

# Model vs easy (challenger = seats 0,2 = play_model)
npm run sim -- euchre --mirror --pairs 500 --seed 2000042 --report \
  --policies play_model,easy,play_model,easy \
  --play-model training/models/play_mlp_hard4.joblib \
  --python training/.venv/bin/python \
  --training-cwd training
```

**Exit criterion:** model closes most of the hard−easy gap on mirrored pair win rate  
(not “beat easy” on raw win rate — that was always coin-flip-shaped).

## Serve (subprocess bridge)

```bash
python -m euchre_play.serve --model models/play_mlp_hard4.joblib
```

## Spike results (so far)

| Metric | Value |
|---|---|
| Offline action-match (hard×4 val) | ~96% (MLP) |
| Raw hard vs easy (400g) | ~52% hard |
| Raw play_model vs easy (400g) | ~49% (HGB) / ~49% (MLP, floor 0.75) |
| HGB live eval | ~30 min / 400g — **do not use for iteration** |

Python is **not** inside `packages/sim`.
