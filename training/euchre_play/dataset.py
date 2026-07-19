"""Load JSONL steps → play-phase teacher examples."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator

import numpy as np

from .cards import card_id_from_obj
from .features import encode_play_features, label_index, legal_mask_from_ids


def iter_jsonl(path: str | Path) -> Iterator[dict]:
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def is_play_teacher_step(rec: dict) -> bool:
    if rec.get("recordType") == "header":
        return False
    if rec.get("schemaVersion") != 1:
        return False
    if rec.get("labelQuality") != "teacher":
        return False
    if rec.get("phase") != "playing":
        return False
    action = rec.get("action") or {}
    if action.get("kind") != "play":
        return False
    return True


def legal_play_card_ids(rec: dict) -> list[str]:
    # Compact dumps use legalCardIds; full dumps use legalActions
    if rec.get("legalCardIds"):
        return [str(c) for c in rec["legalCardIds"]]
    ids: list[str] = []
    for a in rec.get("legalActions") or []:
        if isinstance(a, dict) and a.get("kind") == "play" and a.get("cardId"):
            ids.append(str(a["cardId"]))
    return ids


def load_play_dataset(path: str | Path) -> tuple[np.ndarray, np.ndarray, np.ndarray, dict]:
    """
    Returns X [N, F], y [N] card indices, legal_masks [N, 24], stats.
    """
    xs: list[np.ndarray] = []
    ys: list[int] = []
    masks: list[np.ndarray] = []
    skipped = 0
    total = 0

    for rec in iter_jsonl(path):
        total += 1
        if not is_play_teacher_step(rec):
            continue
        legal_ids = legal_play_card_ids(rec)
        action = rec["action"]
        card_id = str(action["cardId"])
        if card_id not in legal_ids:
            skipped += 1
            continue
        try:
            y = label_index(card_id)
        except KeyError:
            skipped += 1
            continue
        obs = rec.get("observation") or {}
        # Prefer observation hand/trick; legal from step
        x = encode_play_features(obs, legal_ids)
        m = legal_mask_from_ids(legal_ids)
        xs.append(x)
        ys.append(y)
        masks.append(m)

    if not xs:
        raise RuntimeError(f"No play-teacher steps in {path}")

    X = np.stack(xs, axis=0)
    y = np.asarray(ys, dtype=np.int64)
    legal = np.stack(masks, axis=0)
    stats = {
        "path": str(path),
        "lines_read": total,
        "examples": int(X.shape[0]),
        "skipped": skipped,
        "feature_dim": int(X.shape[1]),
    }
    return X, y, legal, stats
