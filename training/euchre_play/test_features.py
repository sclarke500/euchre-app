"""Unit tests for left-bower-aware tracker features."""

from .features import (
    FEAT_DIM,
    compute_voids,
    effective_suit,
    encode_play_features,
    is_left_bower,
    is_trump_card,
    same_color_suit,
)


def test_left_bower_effective_suit():
    assert effective_suit("diamonds-J", "hearts") == "hearts"
    assert effective_suit("hearts-J", "hearts") == "hearts"  # right
    assert effective_suit("clubs-J", "hearts") == "clubs"
    assert is_left_bower("diamonds-J", "hearts")
    assert is_trump_card("diamonds-J", "hearts")
    assert same_color_suit("hearts") == "diamonds"


def test_void_left_bower_follows_trump():
    """Playing left bower on a trump lead is following, not void."""
    obs = {
        "completedTricks": [
            {
                "leadingSuit": "hearts",
                "winnerId": 0,
                "cards": [
                    {"playerId": 0, "cardId": "hearts-A"},
                    {"playerId": 1, "cardId": "diamonds-J"},  # left of hearts
                ],
            }
        ],
        "currentTrick": [],
        "leadingSuit": None,
        "trump": {"suit": "hearts", "calledBy": 0, "goingAlone": False},
        "hand": [],
        "seat": 2,
    }
    voids = compute_voids(obs, "hearts")
    # seat 1 played left bower on hearts lead → following trump, NOT void in hearts
    assert "hearts" not in voids[1]


def test_void_off_suit_on_lead():
    obs = {
        "completedTricks": [
            {
                "leadingSuit": "spades",
                "winnerId": 0,
                "cards": [
                    {"playerId": 0, "cardId": "spades-A"},
                    {"playerId": 1, "cardId": "hearts-9"},  # void in spades
                ],
            }
        ],
        "currentTrick": [],
        "leadingSuit": None,
        "trump": {"suit": "clubs", "calledBy": 0, "goingAlone": False},
        "hand": [],
        "seat": 0,
    }
    voids = compute_voids(obs, "clubs")
    assert "spades" in voids[1]


def test_encode_dim():
    obs = {
        "seat": 0,
        "hand": [{"id": "hearts-A"}, {"id": "hearts-K"}],
        "completedTricks": [],
        "currentTrick": [],
        "leadingSuit": None,
        "trump": {"suit": "hearts", "calledBy": 0, "goingAlone": False},
        "scores": [0, 0],
        "handSizes": [2, 5, 5, 5],
        "dealer": 3,
        "alonePlayer": None,
        "goingAlone": False,
    }
    x = encode_play_features(obs, ["hearts-A", "hearts-K"])
    assert x.shape == (FEAT_DIM,)
    assert x.dtype == "float32"
