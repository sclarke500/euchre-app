#!/usr/bin/env python3
"""
Subprocess inference server for packages/sim play_model policy.

Protocol (one JSON object per line):

  Request:
    {"type":"predict","observation":{...},"legal":[{"kind":"play","cardId":"..."},...]}
    {"type":"ping"}
    {"type":"shutdown"}

  Response:
    {"type":"action","action":{"kind":"play","cardId":"..."}}
    {"type":"pong"}
    {"type":"bye"}
    {"type":"error","message":"..."}
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

import joblib
import numpy as np

from .cards import CARD_IDS, N_CARDS
from .features import encode_play_features


def load_model(path: str):
    payload = joblib.load(path)
    if isinstance(payload, dict) and "model" in payload:
        return payload["model"], payload
    return payload, {"model": payload}


def predict_card(clf, observation: dict, legal: list[dict]) -> tuple[dict[str, Any], float]:
    legal_ids = [
        str(a["cardId"])
        for a in legal
        if isinstance(a, dict) and a.get("kind") == "play" and a.get("cardId")
    ]
    if not legal_ids:
        raise ValueError("no legal play actions")

    x = encode_play_features(observation, legal_ids).reshape(1, -1)
    confidence = 1.0
    if hasattr(clf, "predict_proba"):
        proba = clf.predict_proba(x)[0]
        classes = list(clf.classes_)
        scores = {int(cls): float(proba[i]) for i, cls in enumerate(classes)}
        best_id = None
        best_s = -1.0
        for cid in legal_ids:
            try:
                idx = CARD_IDS.index(cid)
            except ValueError:
                continue
            s = scores.get(idx, -1.0)
            if s > best_s:
                best_s = s
                best_id = cid
        if best_id is None:
            best_id = legal_ids[0]
            best_s = 0.0
        confidence = float(best_s) if best_s >= 0 else 0.0
    else:
        pred = int(clf.predict(x)[0])
        pred_id = CARD_IDS[pred] if 0 <= pred < N_CARDS else None
        best_id = pred_id if pred_id in legal_ids else legal_ids[0]

    return {"kind": "play", "cardId": best_id}, confidence


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    args = ap.parse_args()

    clf, meta = load_model(args.model)
    # Ready signal on stderr so sim can wait
    print(json.dumps({"type": "ready", "version": meta.get("version", 1)}), file=sys.stderr, flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            print(json.dumps({"type": "error", "message": str(e)}), flush=True)
            continue

        rtype = req.get("type")
        if rtype == "ping":
            print(json.dumps({"type": "pong"}), flush=True)
            continue
        if rtype == "shutdown":
            print(json.dumps({"type": "bye"}), flush=True)
            break
        if rtype != "predict":
            print(
                json.dumps({"type": "error", "message": f"unknown type {rtype}"}),
                flush=True,
            )
            continue

        try:
            action, confidence = predict_card(
                clf, req.get("observation") or {}, req.get("legal") or []
            )
            print(
                json.dumps(
                    {"type": "action", "action": action, "confidence": confidence}
                ),
                flush=True,
            )
        except Exception as e:  # noqa: BLE001 — surface to sim
            print(json.dumps({"type": "error", "message": str(e)}), flush=True)


if __name__ == "__main__":
    main()
