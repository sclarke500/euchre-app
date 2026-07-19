#!/usr/bin/env python3
"""Train a tiny MLP to imitate hard AI card play from JSONL teacher steps."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.neural_network import MLPClassifier

from .cards import N_CARDS
from .dataset import load_play_dataset
from .features import FEAT_DIM


def masked_accuracy(clf, X: np.ndarray, y: np.ndarray, legal: np.ndarray) -> float:
    """Argmax over legal cards using predict_proba."""
    if hasattr(clf, "predict_proba"):
        proba = clf.predict_proba(X)
        classes = list(clf.classes_)
        full = np.full((X.shape[0], N_CARDS), -1e9, dtype=np.float64)
        for col, cls in enumerate(classes):
            full[:, int(cls)] = proba[:, col]
    else:
        pred = clf.predict(X)
        return float(np.mean(pred == y))

    full = np.where(legal > 0.5, full, -1e9)
    pred = np.argmax(full, axis=1)
    return float(np.mean(pred == y))


def main() -> None:
    ap = argparse.ArgumentParser(description="Train Euchre play-phase IL model")
    ap.add_argument("--train", required=True, help="Train JSONL path")
    ap.add_argument("--val", required=True, help="Val JSONL path")
    ap.add_argument("--out", required=True, help="Output joblib path")
    ap.add_argument("--max-iter", type=int, default=40)
    ap.add_argument("--hidden", type=int, default=128)
    ap.add_argument(
        "--model",
        choices=("mlp", "hgb"),
        default="hgb",
        help="mlp or hist gradient boosting (default hgb)",
    )
    ap.add_argument("--max-train", type=int, default=0, help="Subsample train rows (0=all)")
    args = ap.parse_args()

    print(f"Loading train: {args.train}")
    Xtr, ytr, mtr, st_tr = load_play_dataset(args.train)
    print(f"  {st_tr}")
    print(f"Loading val: {args.val}")
    Xva, yva, mva, st_va = load_play_dataset(args.val)
    print(f"  {st_va}")

    assert Xtr.shape[1] == FEAT_DIM

    if args.max_train and args.max_train < len(ytr):
        rng = np.random.default_rng(0)
        idx = rng.choice(len(ytr), size=args.max_train, replace=False)
        Xtr, ytr, mtr = Xtr[idx], ytr[idx], mtr[idx]
        print(f"  subsampled train to {len(ytr)}")

    if args.model == "hgb":
        clf = HistGradientBoostingClassifier(
            max_depth=8,
            max_iter=args.max_iter,
            learning_rate=0.08,
            l2_regularization=0.1,
            random_state=0,
            early_stopping=True,
            validation_fraction=0.05,
            n_iter_no_change=8,
            verbose=1,
        )
        print("Fitting HistGradientBoosting…")
    else:
        clf = MLPClassifier(
            hidden_layer_sizes=(args.hidden, args.hidden, args.hidden // 2),
            activation="relu",
            solver="adam",
            max_iter=args.max_iter,
            random_state=0,
            early_stopping=True,
            validation_fraction=0.05,
            n_iter_no_change=8,
            learning_rate_init=0.001,
            verbose=True,
        )
        print("Fitting MLP…")
    clf.fit(Xtr, ytr)

    train_acc = masked_accuracy(clf, Xtr, ytr, mtr)
    val_acc = masked_accuracy(clf, Xva, yva, mva)
    raw_val = float(clf.score(Xva, yva))

    metrics = {
        "train_examples": int(len(ytr)),
        "val_examples": st_va["examples"],
        "train_masked_acc": train_acc,
        "val_masked_acc": val_acc,
        "val_raw_acc": raw_val,
        "feature_dim": FEAT_DIM,
        "n_cards": N_CARDS,
        "model": args.model,
        "hidden": args.hidden,
        "max_iter": args.max_iter,
    }
    print(json.dumps(metrics, indent=2))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "model": clf,
        "metrics": metrics,
        "feature_dim": FEAT_DIM,
        "version": 1,
        "phase": "playing",
    }
    joblib.dump(payload, out)
    print(f"Wrote {out}")

    side = out.with_suffix(".metrics.json")
    side.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {side}")


if __name__ == "__main__":
    main()
