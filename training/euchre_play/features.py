"""
Observation → fixed-size feature vector for play-phase decisions.

Consumes imperfect-info observation from packages/sim (encode/euchre.ts).
Derived "tracker" features (voids, bowers, trump remaining, partner winning)
are computed here from public history — not baked into the frozen obs schema.

**Left bower:** effective suit is trump. Void inference and trump counts must
reclassify the same-color jack once trump is known (mirrors GameTracker).
"""

from __future__ import annotations

import numpy as np

from .cards import CARD_IDS, CARD_INDEX, N_CARDS, SUIT_INDEX, SUITS, card_id_from_obj

# ---------------------------------------------------------------------------
# Layout (v2 — tracker-aware)
# ---------------------------------------------------------------------------
#   hand 24
#   played so far (bag) 24
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
#   last trick winner relative 4
#   --- tracker-style (new) ---
#   voids: 4 relative seats × 4 suits  16
#   right/left bower played 2
#   I hold right / left bower 2
#   trump remaining outside hand /7  1
#   per-suit remaining outside hand /6  4  (trump suit uses /7)
#   partner currently winning 1
#   current trick winner relative 4
#   trick index /4  1
#   both bowers played 1

TRACKER_DIM = 16 + 2 + 2 + 1 + 4 + 1 + 4 + 1 + 1  # 32

FEAT_DIM = (
    N_CARDS  # hand
    + N_CARDS  # played bag
    + N_CARDS  # current trick
    + 5
    + 4
    + 4
    + 4
    + 4
    + 2
    + 4
    + 1
    + 1
    + N_CARDS  # legal
    + 4
    + 4
    + TRACKER_DIM
)

# Card strength order for following/trump (higher = better). Rank index within suit.
_RANK_ORDER = {"9": 0, "10": 1, "J": 2, "Q": 3, "K": 4, "A": 5}

SAME_COLOR = {
    "hearts": "diamonds",
    "diamonds": "hearts",
    "clubs": "spades",
    "spades": "clubs",
}


def same_color_suit(suit: str) -> str:
    return SAME_COLOR[suit]


def parse_card_id(cid: str) -> tuple[str, str] | None:
    """'hearts-J' → (suit, rank). Handles '10'."""
    if not cid or cid not in CARD_INDEX:
        # still try parse
        if not cid or "-" not in cid:
            return None
    parts = cid.rsplit("-", 1)
    if len(parts) != 2:
        return None
    suit, rank = parts[0], parts[1]
    if suit not in SUIT_INDEX or rank not in _RANK_ORDER:
        return None
    return suit, rank


def effective_suit(cid: str, trump: str | None) -> str | None:
    parsed = parse_card_id(cid)
    if not parsed:
        return None
    suit, rank = parsed
    if trump and rank == "J" and suit == same_color_suit(trump):
        return trump
    return suit


def is_right_bower(cid: str, trump: str) -> bool:
    return cid == f"{trump}-J"


def is_left_bower(cid: str, trump: str) -> bool:
    return cid == f"{same_color_suit(trump)}-J"


def is_trump_card(cid: str, trump: str) -> bool:
    return effective_suit(cid, trump) == trump


def card_power(cid: str, trump: str, leading: str | None) -> int:
    """
    Higher wins the trick. Only cards that can win (trump or following lead)
    get positive power; others 0.
    Bower order: right=100, left=99, then A..9 of trump, then A..9 of lead.
    """
    parsed = parse_card_id(cid)
    if not parsed:
        return 0
    suit, rank = parsed
    eff = effective_suit(cid, trump)
    if eff is None:
        return 0

    if is_right_bower(cid, trump):
        return 200
    if is_left_bower(cid, trump):
        return 190

    rank_v = _RANK_ORDER[rank]
    if eff == trump:
        return 100 + rank_v
    if leading and eff == leading:
        return 10 + rank_v
    return 0


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


def _mark_card(x: np.ndarray, base: int, cid: str | None) -> None:
    if cid and cid in CARD_INDEX:
        x[base + CARD_INDEX[cid]] = 1.0


def _iter_public_plays(observation: dict):
    """Yield (player_id, card_id, leading_suit) for completed tricks + current."""
    for t in observation.get("completedTricks") or []:
        lead = t.get("leadingSuit")
        for pc in t.get("cards") or []:
            if not isinstance(pc, dict):
                continue
            cid = pc.get("cardId") or card_id_from_obj(pc.get("card"))
            pid = pc.get("playerId")
            if cid is not None and pid is not None:
                yield int(pid), str(cid), lead

    lead_cur = observation.get("leadingSuit")
    for pc in observation.get("currentTrick") or []:
        if not isinstance(pc, dict):
            continue
        card = pc.get("card")
        cid = card_id_from_obj(card) if card else pc.get("cardId")
        pid = pc.get("playerId")
        if cid is not None and pid is not None:
            yield int(pid), str(cid), lead_cur


def compute_voids(
    observation: dict, trump: str | None
) -> list[set[str]]:
    """
    Per absolute seat: set of suits they are known void in.
    Void if they failed to follow the *led* suit (using effective suit of card).
    """
    voids: list[set[str]] = [set() for _ in range(4)]
    if not trump:
        return voids

    for t in observation.get("completedTricks") or []:
        lead = t.get("leadingSuit")
        if not lead:
            continue
        for pc in t.get("cards") or []:
            if not isinstance(pc, dict):
                continue
            cid = pc.get("cardId") or card_id_from_obj(pc.get("card"))
            pid = pc.get("playerId")
            if cid is None or pid is None:
                continue
            eff = effective_suit(str(cid), trump)
            if eff is not None and eff != lead:
                voids[int(pid)].add(lead)

    lead_cur = observation.get("leadingSuit")
    if lead_cur:
        for pc in observation.get("currentTrick") or []:
            if not isinstance(pc, dict):
                continue
            card = pc.get("card")
            cid = card_id_from_obj(card) if card else pc.get("cardId")
            pid = pc.get("playerId")
            if cid is None or pid is None:
                continue
            eff = effective_suit(str(cid), trump)
            if eff is not None and eff != lead_cur:
                voids[int(pid)].add(lead_cur)

    return voids


def current_trick_winner(observation: dict, trump: str | None) -> int | None:
    """Seat currently winning the incomplete trick, or None if empty / no trump."""
    if not trump:
        return None
    cards = observation.get("currentTrick") or []
    if not cards:
        return None
    lead = observation.get("leadingSuit")
    best_pid: int | None = None
    best_pow = -1
    for pc in cards:
        if not isinstance(pc, dict):
            continue
        card = pc.get("card")
        cid = card_id_from_obj(card) if card else pc.get("cardId")
        pid = pc.get("playerId")
        if cid is None or pid is None:
            continue
        p = card_power(str(cid), trump, lead)
        if p > best_pow:
            best_pow = p
            best_pid = int(pid)
    return best_pid


def hand_card_ids(observation: dict) -> set[str]:
    out: set[str] = set()
    for c in observation.get("hand") or []:
        cid = card_id_from_obj(c)
        if cid:
            out.add(cid)
    return out


def played_card_ids(observation: dict) -> set[str]:
    out: set[str] = set()
    for _pid, cid, _lead in _iter_public_plays(observation):
        out.add(cid)
    return out


def encode_play_features(observation: dict, legal_card_ids: list[str]) -> np.ndarray:
    x = np.zeros(FEAT_DIM, dtype=np.float32)
    off = 0

    my_hand = hand_card_ids(observation)
    played = played_card_ids(observation)
    trump = (observation.get("trump") or {}).get("suit")
    seat = int(observation.get("seat") or 0)

    # --- hand ---
    for cid in my_hand:
        _mark_card(x, off, cid)
    off += N_CARDS

    # --- played bag ---
    for cid in played:
        _mark_card(x, off, cid)
    off += N_CARDS

    # --- current trick bag ---
    for pc in observation.get("currentTrick") or []:
        if isinstance(pc, dict):
            card = pc.get("card")
            cid = card_id_from_obj(card) if card else pc.get("cardId")
            _mark_card(x, off, cid)
    off += N_CARDS

    lead = observation.get("leadingSuit")
    x[off : off + 5] = _one_hot_suit(lead, include_none=True)
    off += 5

    x[off : off + 4] = _one_hot_suit(trump)
    off += 4

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

    n_in_trick = len(observation.get("currentTrick") or [])
    x[off] = n_in_trick / 4.0
    off += 1

    for cid in legal_card_ids:
        if cid in CARD_INDEX:
            x[off + CARD_INDEX[cid]] = 1.0
    off += N_CARDS

    if 0 <= seat < 4:
        x[off + seat] = 1.0
    off += 4

    completed = observation.get("completedTricks") or []
    last_w = completed[-1].get("winnerId") if completed else None
    x[off : off + 4] = _rel_seat_onehot(seat, last_w)
    off += 4

    # ===================================================================
    # Tracker-style features
    # ===================================================================
    voids = compute_voids(observation, trump)

    # voids: relative seats × 4 suits (self first = zeros usually)
    for rel in range(4):
        abs_seat = (seat + rel) % 4
        for s_i, sname in enumerate(SUITS):
            if sname in voids[abs_seat]:
                x[off + rel * 4 + s_i] = 1.0
    off += 16

    right_played = False
    left_played = False
    hold_right = False
    hold_left = False
    trump_remaining = 0.0
    suit_remaining = [0.0, 0.0, 0.0, 0.0]

    if trump:
        right_id = f"{trump}-J"
        left_id = f"{same_color_suit(trump)}-J"
        right_played = right_id in played
        left_played = left_id in played
        hold_right = right_id in my_hand
        hold_left = left_id in my_hand

        # trump remaining outside my hand: total 7 − played_trump − my_trump
        my_trump = sum(1 for c in my_hand if is_trump_card(c, trump))
        played_trump = sum(1 for c in played if is_trump_card(c, trump))
        trump_remaining = max(0, 7 - played_trump - my_trump) / 7.0

        for s_i, sname in enumerate(SUITS):
            # cards of this printed suit that are still "out" (not me, not played)
            # left bower: not counted in printed suit remaining; counted in trump
            remaining = 0
            for cid in CARD_IDS:
                p = parse_card_id(cid)
                if not p:
                    continue
                suit, rank = p
                if cid in my_hand or cid in played:
                    continue
                if is_left_bower(cid, trump):
                    # left is trump, not printed suit
                    continue
                if suit == sname:
                    remaining += 1
            # if this is trump suit, also count left bower if still out
            if sname == trump:
                if left_id not in my_hand and left_id not in played:
                    remaining += 1  # left as extra trump
                denom = 7.0
            else:
                denom = 6.0
            suit_remaining[s_i] = remaining / denom

    x[off] = 1.0 if right_played else 0.0
    x[off + 1] = 1.0 if left_played else 0.0
    off += 2
    x[off] = 1.0 if hold_right else 0.0
    x[off + 1] = 1.0 if hold_left else 0.0
    off += 2
    x[off] = float(trump_remaining)
    off += 1
    for i in range(4):
        x[off + i] = float(suit_remaining[i])
    off += 4

    win_seat = current_trick_winner(observation, trump)
    partner = (seat + 2) % 4
    partner_winning = win_seat is not None and win_seat == partner
    x[off] = 1.0 if partner_winning else 0.0
    off += 1
    x[off : off + 4] = _rel_seat_onehot(seat, win_seat)
    off += 4

    trick_idx = len(completed)
    x[off] = min(trick_idx, 4) / 4.0
    off += 1

    x[off] = 1.0 if (right_played and left_played) else 0.0
    off += 1

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
