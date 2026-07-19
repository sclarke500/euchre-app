#!/usr/bin/env python3
"""
Offline action-match metric (inner-loop iteration signal).

Overall match is inflated by forced plays (1 legal card). Report:
  - overall
  - forced (len(legal)==1) — should be ~100%
  - contested (len(legal)>=2) — the real skill signal
  - contested × lead vs follow
  - contested × trick number (0–4) when available from obs

  python -m euchre_play.action_match --model models/play_mlp.joblib --val data/val.jsonl
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict

import joblib

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


def trick_number(obs: dict) -> int | None:
    """0–4 index of current trick within the hand, from completedTricks count."""
    completed = obs.get("completedTricks")
    if completed is None:
        return None
    return len(completed)


def is_lead(obs: dict) -> bool:
    """Leading the trick: empty currentTrick (and no leadingSuit yet)."""
    ct = obs.get("currentTrick") or []
    return len(ct) == 0


class Bucket:
    __slots__ = ("hit", "n")

    def __init__(self) -> None:
        self.hit = 0
        self.n = 0

    def add(self, ok: bool) -> None:
        self.n += 1
        self.hit += int(ok)

    def rate(self) -> float | None:
        return (self.hit / self.n) if self.n else None

    def as_dict(self) -> dict:
        r = self.rate()
        return {
            "n": self.n,
            "hit": self.hit,
            "match": None if r is None else round(r, 4),
            "match_pct": None if r is None else round(r * 100, 2),
        }


def main() -> None:
    ap = argparse.ArgumentParser(description="Offline action-match vs teacher labels")
    ap.add_argument("--model", required=True)
    ap.add_argument("--val", required=True, help="Val JSONL (teacher play steps)")
    ap.add_argument("--max-steps", type=int, default=0, help="0 = all")
    args = ap.parse_args()

    clf, meta = load_model(args.model)

    overall = Bucket()
    forced = Bucket()  # 1 legal
    contested = Bucket()  # 2+ legal
    lead = Bucket()
    follow = Bucket()
    by_trick: dict[int, Bucket] = defaultdict(Bucket)
    by_n_legal: dict[int, Bucket] = defaultdict(Bucket)
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

        obs = rec.get("observation") or {}
        pred = predict_legal(clf, obs, legal)
        ok = pred == true_id
        n_legal = len(legal)

        overall.add(ok)
        by_n_legal[n_legal].add(ok)

        if n_legal <= 1:
            forced.add(ok)
        else:
            contested.add(ok)
            if is_lead(obs):
                lead.add(ok)
            else:
                follow.add(ok)
            tn = trick_number(obs)
            if tn is not None:
                by_trick[tn].add(ok)

        if args.max_steps and overall.n >= args.max_steps:
            break

    if overall.n == 0:
        raise SystemExit("no play-teacher steps found")

    out = {
        "model": str(args.model),
        "val": str(args.val),
        "skipped": skipped,
        "feature_dim": meta.get("feature_dim"),
        "overall": overall.as_dict(),
        "forced_1_legal": forced.as_dict(),
        "contested_2plus_legal": contested.as_dict(),
        "contested_lead": lead.as_dict(),
        "contested_follow": follow.as_dict(),
        "contested_by_trick": {
            str(k): by_trick[k].as_dict() for k in sorted(by_trick.keys())
        },
        "by_n_legal": {
            str(k): by_n_legal[k].as_dict() for k in sorted(by_n_legal.keys())
        },
    }
    print(json.dumps(out, indent=2))

    def line(label: str, b: Bucket) -> str:
        r = b.rate()
        if r is None:
            return f"  {label}: n=0"
        return f"  {label}: {r * 100:.2f}%  ({b.hit}/{b.n})"

    print("\n=== action-match breakdown ===")
    print(line("overall", overall))
    print(line("forced (1 legal)", forced))
    print(line("contested (2+ legal)  ← real skill signal", contested))
    print(line("  contested lead", lead))
    print(line("  contested follow", follow))
    if by_trick:
        print("  contested by trick #:")
        for k in sorted(by_trick.keys()):
            print(line(f"    trick {k}", by_trick[k]))


if __name__ == "__main__":
    main()
