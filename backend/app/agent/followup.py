from __future__ import annotations

import hashlib
import re

HEDGE_RE = re.compile(
    r"\b(i think|i feel|maybe|perhaps|sort of|kind of|basically|actually|"
    r"you know|i mean|probably|possibly|somewhat|more or less|etc\.?|"
    r"and so on|various things|many things|as such|in a way|not sure)\b",
    re.I,
)
VAGUE_RE = re.compile(
    r"\b(holistic|synergy|leverage|going forward|at the end of the day|"
    r"overall|in general|whatever|stuff|things like that)\b",
    re.I,
)


def _ratio(seed: str) -> float:
    h = int(hashlib.sha256(seed.encode("utf-8")).hexdigest(), 16)
    return (h % 10000) / 10000.0


def should_follow_up(answer: str, prior_turns: list[dict]) -> bool:
    """
    Decide whether the board should press on this answer instead of a fresh topic.
    Targets ~40–50% overall, higher on vague / short / hedged answers.
    Deterministic given the same answer text (stable for eval).
    """
    text = (answer or "").strip()
    if not text:
        return False

    board_n = sum(1 for t in prior_turns if t.get("role") == "board")
    # Never follow-up before the welcome lands; after intro, short answers get pressed
    if board_n == 0:
        words0 = len(text.split())
        return words0 < 45 and _ratio(text + "|intro") < 0.55

    words = text.split()
    n = len(words)
    hedges = len(HEDGE_RE.findall(text))
    vague = len(VAGUE_RE.findall(text))

    score = 0.18  # base inclination toward some cross-questioning
    if n < 40:
        score += 0.18
    if n < 18:
        score += 0.22
    if n > 220:
        score += 0.12  # ramble → "clarify one point"
    if hedges >= 2:
        score += 0.16
    if hedges >= 4:
        score += 0.12
    if vague >= 1:
        score += 0.12

    # Candidate echoed a DAF-ish claim — boards often probe consistency
    daf_hits = 0
    prior_board = " ".join(
        t.get("text", "") for t in prior_turns if t.get("role") == "board"
    ).lower()
    for token in ("optional", "hobby", "state", "village", "degree", "work", "job"):
        if token in text.lower() and token in prior_board:
            daf_hits += 1
    if daf_hits:
        score += 0.1 * min(daf_hits, 3)

    # Soft cap so we don't always follow up
    p = min(0.72, max(0.28, score))
    return _ratio(text[:240] + f"|fu|{board_n}") < p


def follow_up_hints(answer: str) -> list[str]:
    """Lightweight cues for the generator / fallbacks."""
    hints: list[str] = []
    words = answer.split()
    if len(words) < 20:
        hints.append("answer_was_very_short")
    if len(HEDGE_RE.findall(answer)) >= 2:
        hints.append("answer_was_hedged")
    if len(VAGUE_RE.findall(answer)) >= 1:
        hints.append("answer_was_vague")
    if len(words) > 200:
        hints.append("answer_was_long_ask_one_point")
    return hints or ["press_for_specificity"]
