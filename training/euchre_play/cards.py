"""Fixed 24-card Euchre deck encoding (matches shared deck ids: `{suit}-{rank}`)."""

from __future__ import annotations

SUITS = ("hearts", "diamonds", "clubs", "spades")
RANKS = ("9", "10", "J", "Q", "K", "A")

CARD_IDS: list[str] = [f"{s}-{r}" for s in SUITS for r in RANKS]
CARD_INDEX: dict[str, int] = {cid: i for i, cid in enumerate(CARD_IDS)}
N_CARDS = len(CARD_IDS)  # 24

SUIT_INDEX = {s: i for i, s in enumerate(SUITS)}
RANK_INDEX = {r: i for i, r in enumerate(RANKS)}


def card_id_from_obj(card: dict | None) -> str | None:
    if not card:
        return None
    if "id" in card and card["id"]:
        return str(card["id"])
    suit = card.get("suit")
    rank = card.get("rank")
    if suit is None or rank is None:
        return None
    return f"{suit}-{rank}"
