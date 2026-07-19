#!/usr/bin/env python3
"""
Offline action-match metric (inner-loop iteration signal).

On held-out teacher play steps: how often does the model pick the same card
as the teacher label? Seconds, no sim rollouts, no subprocess games.

  python -m euchre_play.action_match --model models/play_mlp_hard4.joblib --val data/euchre-hard4-val-1k.jsonl
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np

from .cards import CARD_IDS, N_CARDS
from .dataset import is_play_teacher_step, iter_jsonl, legal_play_card_ids
from .features import encode_play_features, label_index


def load_model(path: str):
    payload = joblib.load(path)
    if isinstance(payload, dict) and "model" in payload:
        return payload["model"], payload
    return payload, {}


def predict_legal(clf, observation: dict, legal_ids: list[str]) -> str:
    x = encode_play_features(observation, legal_ids).reshape(1, -1)
    if hasattr(clf, "predict_proba"):
        proba = clf.predict_proba(x)[0]
        classes = list(clf.classes_)
        scores = {int(cls): float(proba[i]) for i, cls in enumerate(classes)}
        best_id, best_s = legal_ids[0], -1.0
        for cid in legal_ids:
            try:
                idx = CARD_IDS.index(cid)
            except ValueError:
                continue
            s = scores.get(idx, -1.0)
            if s > best_s:
                best_s, best_id = s, cid
        return best_id
    pred = int(clf.predict(x)[0])
    pred_id = CARD_IDS[pred] if 0 <= pred < N_CARDS else legal_ids[0]
    return pred_id if pred_id in legal_ids else legal_ids[0]


def main() -> None:
    ap = argparse.ArgumentParser(description="Offline action-match vs teacher labels")
    ap.add_argument("--model", required=True)
    ap.add_argument("--val", required=True, help="Val JSONL (teacher play steps)")
    ap.add_argument("--max-steps", type=int, default=0, help="0 = all")
    args = ap.parse_args()

    clf, meta = load_model(args.model)
    hit = 0
    n = 0
    skipped = 0

    for rec in iter_jsonl(args.val):
        if not is_play_teacher_step(rec):
            continue
        legal = legal_play_card_ids(rec)
        action = rec.get("action") or {}
        true_id = str(action.get("cardId") or "")
        if not legal or true_id not in legal:
            skipped += 1
            continue
        try:
            label_index(true_id)
        except KeyError:
            skipped += 1
            continue
        pred = predict_legal(clf, rec.get("observation") or {}, legal)
        hit += int(pred == true_id)
        n += 1
        if args.max_steps and n >= args.max_steps:
            break

    if n == 0:
        raise SystemExit("no play-teacher steps found")

    rate = hit / n
    out = {
        "model": str(args.model),
        "val": str(args.val),
        "examples": n,
        "skipped": skipped,
        "action_match": rate,
        "action_match_pct": round(rate * 100, 2),
        "feature_dim": meta.get("feature_dim"),
    }
    print(json.dumps(out, indent=2))
    print(f"\naction-match: {rate * 100:.2f}%  ({hit}/{n})")


if __name__ == "__main__":
    main()
