# Training spike (S1.5)

Python lives **here**, not in `packages/sim`. Sim dumps JSONL; this package trains and serves a tiny play-card model.

## Setup

```bash
cd training
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Data (hard×4 play-teacher dumps — preferred)

```bash
# Train (seed 42) — compact teacher play lines only
npm run sim -- euchre --games 5000 --policies hard,hard,hard,hard --seed 42 \
  --dump-mode play_teacher \
  --out training/data/euchre-hard4-train-5k.jsonl --report

# Val (disjoint seed)
npm run sim -- euchre --games 1000 --policies hard,hard,hard,hard --seed 1000042 \
  --dump-mode play_teacher \
  --out training/data/euchre-hard4-val-1k.jsonl --report
```

## Train (play-phase teacher only)

```bash
python -m euchre_play.train \
  --train data/euchre-hard4-train-5k.jsonl \
  --val data/euchre-hard4-val-1k.jsonl \
  --out models/play_mlp_hard4.joblib \
  --model mlp
```

Use **MLP** for the iteration loop. HGB is slower to serve over the subprocess bridge — not for live eval.

## Inner-loop metric: action-match (no rollouts)

```bash
python -m euchre_play.action_match \
  --model models/play_mlp_hard4.joblib \
  --val data/euchre-hard4-val-1k.jsonl
```

This is the default “did this change help?” signal (seconds).

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
