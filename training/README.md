# Training spike (S1.5)

Python lives **here**, not in `packages/sim`. Sim dumps JSONL; this package trains and serves a tiny play-card model.

## Setup

```bash
cd training
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Data (train / val by seed)

From repo root:

```bash
# Train (~10k games, seed 42)
npm run sim -- euchre --games 10000 --mix default --seed 42 \
  --out training/data/euchre-train-10k.jsonl --report

# Val (seed range disjoint from train)
npm run sim -- euchre --games 2000 --mix default --seed 1000042 \
  --out training/data/euchre-val-2k.jsonl --report
```

## Train (play-phase teacher only)

```bash
python -m euchre_play.train \
  --train data/euchre-train-10k.jsonl \
  --val data/euchre-val-2k.jsonl \
  --out models/play_mlp.joblib
```

Offline metric: **action-match** vs hard on held-out play steps (`labelQuality == teacher`).

## Serve (subprocess bridge for sim)

```bash
python -m euchre_play.serve --model models/play_mlp.joblib
```

Protocol: one JSON object per line on stdin → one JSON action per line on stdout.
See `euchre_play/serve.py`.

## Eval in sim (hybrid: hard bids, model play)

```bash
# From repo root, with venv python on PATH or absolute --python
npm run sim -- euchre --games 200 --seed 2000042 --report \
  --policies play_model,easy,play_model,easy \
  --play-model training/models/play_mlp.joblib \
  --python training/.venv/bin/python
```

**Exit criterion (S1.5):** play_model partnership beats easy partnership in sim.

### Spike results (first pass)

| Metric | Value |
|---|---|
| Train dump | 5k games seed 42 (`data/euchre-train-5k.jsonl`, ~1.8GB — slim dumps next) |
| Val dump | 1k games seed 1000042 |
| Teacher play steps | ~751k train / ~152k val |
| Offline val action-match | ~95% |
| Live vs hard action-match | ~96% (same-state) |
| hard vs easy (400g) | **52%** hard |
| play_model vs easy (400g) | **45%** model — **exit criterion not met yet** |

Offline match does not equal win rate: the remaining 5% card errors compound. Next loop: denser hard×4 dumps, better features / model, dump size reduction, then retrain.

Python is **not** inside `packages/sim`. Sim steers dumps; Python trains + serves; sim eval uses `--play-model` subprocess bridge.
