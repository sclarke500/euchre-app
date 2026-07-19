"""
Observation → fixed-size feature vector for play-phase decisions.

Consumes imperfect-info observation from packages/sim (encode/euchre.ts).
"""

from __future__ import annotations

import numpy as np

from .cards import CARD_IDS, CARD_INDEX, N_CARDS, SUIT_INDEX, card_id_from_obj

# Layout:
#   hand 24
#   played so far this hand (completed tricks + current) 24
#   current trick cards 24
#   leading suit 5
#   trump suit 4
#   dealer / alone / caller relative 4+4+4
#   scores 2
#   hand sizes 4
#   going alone 1
#   trick fill 1
#   legal mask 24
#   seat absolute 4
#   relative seat of last trick winner 4 (or zeros)
FEAT_DIM = (
    N_CARDS
    + N_CARDS
    + N_CARDS
    + 5
    + 4
    + 4
    + 4
    + 4
    + 2
    + 4
    + 1
    + 1
    + N_CARDS
    + 4
    + 4
)


def _one_hot_suit(suit: str | None, include_none: bool = False) -> np.ndarray:
    if include_none:
        v = np.zeros(5, dtype=np.float32)
        if suit is None:
            v[4] = 1.0
        elif suit in SUIT_INDEX:
            v[SUIT_INDEX[suit]] = 1.0
        return v
    v = np.zeros(4, dtype=np.float32)
    if suit in SUIT_INDEX:
        v[SUIT_INDEX[suit]] = 1.0
    return v


def _rel_seat_onehot(seat: int, other: int | None) -> np.ndarray:
    v = np.zeros(4, dtype=np.float32)
    if other is None:
        return v
    rel = (int(other) - int(seat)) % 4
    v[rel] = 1.0
    return v


def _mark_card(vec_off: np.ndarray, base: int, cid: str | None) -> None:
    if cid and cid in CARD_INDEX:
        vec_off[base + CARD_INDEX[cid]] = 1.0


def encode_play_features(observation: dict, legal_card_ids: list[str]) -> np.ndarray:
    x = np.zeros(FEAT_DIM, dtype=np.float32)
    off = 0

    hand = observation.get("hand") or []
    for c in hand:
        _mark_card(x, off, card_id_from_obj(c))
    off += N_CARDS

    # All cards seen this hand (public)
    played_base = off
    for t in observation.get("completedTricks") or []:
        for pc in t.get("cards") or []:
            if isinstance(pc, dict):
                cid = pc.get("cardId") or card_id_from_obj(pc.get("card"))
                _mark_card(x, played_base, cid)
    for pc in observation.get("currentTrick") or []:
        if isinstance(pc, dict):
            card = pc.get("card")
            cid = card_id_from_obj(card) if card else pc.get("cardId")
            _mark_card(x, played_base, cid)
    off += N_CARDS

    trick_base = off
    for pc in observation.get("currentTrick") or []:
        if isinstance(pc, dict):
            card = pc.get("card")
            cid = card_id_from_obj(card) if card else pc.get("cardId")
            _mark_card(x, trick_base, cid)
    off += N_CARDS

    lead = observation.get("leadingSuit")
    x[off : off + 5] = _one_hot_suit(lead, include_none=True)
    off += 5

    trump = (observation.get("trump") or {}).get("suit")
    x[off : off + 4] = _one_hot_suit(trump)
    off += 4

    seat = int(observation.get("seat") or 0)
    x[off : off + 4] = _rel_seat_onehot(seat, observation.get("dealer"))
    off += 4
    x[off : off + 4] = _rel_seat_onehot(seat, observation.get("alonePlayer"))
    off += 4
    caller = (observation.get("trump") or {}).get("calledBy")
    x[off : off + 4] = _rel_seat_onehot(seat, caller)
    off += 4

    scores = observation.get("scores") or [0, 0]
    x[off] = float(scores[0] if len(scores) > 0 else 0) / 10.0
    x[off + 1] = float(scores[1] if len(scores) > 1 else 0) / 10.0
    off += 2

    sizes = observation.get("handSizes") or [0, 0, 0, 0]
    for i in range(4):
        x[off + i] = float(sizes[i] if i < len(sizes) else 0) / 5.0
    off += 4

    x[off] = 1.0 if observation.get("goingAlone") else 0.0
    off += 1

    n_trick = len(observation.get("currentTrick") or [])
    x[off] = n_trick / 4.0
    off += 1

    for cid in legal_card_ids:
        if cid in CARD_INDEX:
            x[off + CARD_INDEX[cid]] = 1.0
    off += N_CARDS

    # absolute seat
    if 0 <= seat < 4:
        x[off + seat] = 1.0
    off += 4

    # last completed trick winner relative
    completed = observation.get("completedTricks") or []
    last_w = completed[-1].get("winnerId") if completed else None
    x[off : off + 4] = _rel_seat_onehot(seat, last_w)
    off += 4

    assert off == FEAT_DIM, f"feature packing bug: {off} != {FEAT_DIM}"
    return x


def legal_mask_from_ids(legal_card_ids: list[str]) -> np.ndarray:
    m = np.zeros(N_CARDS, dtype=np.float32)
    for cid in legal_card_ids:
        if cid in CARD_INDEX:
            m[CARD_INDEX[cid]] = 1.0
    return m


def label_index(card_id: str) -> int:
    if card_id not in CARD_INDEX:
        raise KeyError(f"unknown card id: {card_id}")
    return CARD_INDEX[card_id]


def card_id_from_index(i: int) -> str:
    return CARD_IDS[i]
