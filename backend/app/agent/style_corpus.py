from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

PACK_PATH = Path(__file__).resolve().parent / "data" / "board_style_pack.json"
STOP = {
    "that",
    "this",
    "with",
    "have",
    "from",
    "your",
    "about",
    "would",
    "what",
    "when",
    "were",
    "been",
    "they",
    "them",
    "then",
}


@lru_cache(maxsize=1)
def _pack() -> dict:
    if not PACK_PATH.exists():
        return {"pairs": [], "pairCount": 0, "source": "", "version": 0}
    return json.loads(PACK_PATH.read_text(encoding="utf-8"))


def _tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{4,}", (text or "").lower()) if w not in STOP}


def retrieve_style_examples(query: str, n: int = 3) -> list[dict]:
    pairs = _pack().get("pairs") or []
    scored = []
    q = _tokens(query)
    for pair in pairs:
        blob = f"{pair.get('board','')} {pair.get('priorAnswer','')} {' '.join(pair.get('tags') or [])}"
        p = _tokens(blob)
        hit = len(q & p) if q else 0
        for tag in pair.get("tags") or []:
            if tag in (query or "").lower():
                hit += 2
        if pair.get("priorAnswer"):
            hit += 0.5
        scored.append((hit, pair))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = [p for s, p in scored if s > 0][:n]
    if len(top) < n:
        for _, p in scored:
            if p not in top:
                top.append(p)
            if len(top) >= n:
                break
    return top[:n]


def style_prompt_block(query: str, last_answer: str | None = None) -> str:
    ex = retrieve_style_examples(f"{query}\n{last_answer or ''}", 3)
    if not ex:
        return "(no style exemplars)"
    blocks = []
    for i, e in enumerate(ex, 1):
        prior = e.get("priorAnswer") or "(none)"
        blocks.append(
            f"EXEMPLAR_{i}:\nPRIOR_ANSWER: {str(prior)[:180]}\nBOARD_SAID: {e.get('board')}"
        )
    return "\n\n".join(blocks)


def corpus_fallback_question(
    seed: str,
    last_answer: str | None = None,
    prefer_follow_up: bool = False,
) -> str:
    ex = retrieve_style_examples(f"{seed}\n{last_answer or ''}", 8)
    if prefer_follow_up and last_answer:
        snip = " ".join(last_answer.split()[:18])
        return (
            f'You mentioned "{snip}". Stay with that — what exactly would you do first, '
            f"and who is helped or hurt?"
        )
    if not ex:
        return "Please introduce yourself briefly — education, hometown, and why you are here."
    h = abs(hash(seed))
    return str(ex[h % len(ex)].get("board") or "")
