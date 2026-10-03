from __future__ import annotations

from typing import Any

from app.agent.followup import follow_up_hints, should_follow_up
from app.agent.memory import memory_prompt_block
from app.agent.ollama_client import board_chat, extract_json_object

MOVES = {"press", "clarify", "new_topic", "invite_example", "bridge_close"}
DOMAINS = {"chair-daf", "subject", "affairs-ethics", "quiet", "skeptic"}


def _clamp01(n: float) -> float:
    try:
        return min(1.0, max(0.0, float(n)))
    except (TypeError, ValueError):
        return 0.0


def _snippet(answer: str) -> str:
    words = answer.strip().split()
    s = " ".join(words[:18])
    if len(words) > 18:
        s = s.rstrip(",.") + "…"
    return s


def heuristic_analyze(
    answer: str,
    turns: list[dict],
    memory: dict[str, Any],
) -> dict[str, Any]:
    hints = follow_up_hints(answer)
    words = answer.strip().split()
    n = len(words)
    soft_follow = should_follow_up(answer, turns)
    strong_thin = (
        "answer_was_very_short" in hints
        or "answer_was_hedged" in hints
        or "answer_was_vague" in hints
    )
    move = "new_topic"
    if strong_thin or soft_follow:
        if "answer_was_very_short" in hints:
            move = "invite_example"
        elif "answer_was_hedged" in hints or "answer_was_vague" in hints:
            move = "clarify"
        else:
            move = "press"
    elif float(memory.get("pressureLevel") or 0) > 0.75 and sum(
        1 for t in turns if t.get("role") == "board"
    ) >= 6:
        move = "bridge_close"

    specificity = _clamp01(0.15 if n < 18 else 0.35 if n < 40 else 0.6 if n < 120 else 0.75)
    hedging = _clamp01(
        0.7
        if "answer_was_hedged" in hints
        else 0.55
        if "answer_was_vague" in hints
        else 0.2
    )

    domain = "chair-daf"
    if move in ("press", "clarify"):
        threads = memory.get("openThreads") or []
        if threads:
            owner = threads[-1].get("ownerSpeakerId")
            mapping = {
                "chair": "chair-daf",
                "member-a": "subject",
                "member-b": "affairs-ethics",
                "member-c": "quiet",
                "member-d": "skeptic",
            }
            domain = mapping.get(owner, "skeptic")
        elif hedging > 0.5:
            domain = "skeptic"

    snip = _snippet(answer)
    return {
        "specificity": specificity,
        "hedging": hedging,
        "contradictionRisk": _clamp01(hedging * 0.4),
        "extractClaims": [snip] if n >= 8 else [],
        "suggestedMove": move,
        "bestSpeakerDomain": domain,
        "threadTopic": snip or "last answer",
        "quoteSnippet": snip,
        "source": "heuristic",
    }


def _normalize(raw: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
    move = str(raw.get("suggestedMove") or "")
    domain = str(raw.get("bestSpeakerDomain") or "")
    claims = raw.get("extractClaims")
    if isinstance(claims, list):
        claims = [str(c).strip() for c in claims if str(c).strip()][:6]
    else:
        claims = fallback["extractClaims"]
    return {
        "specificity": _clamp01(raw.get("specificity", fallback["specificity"])),
        "hedging": _clamp01(raw.get("hedging", fallback["hedging"])),
        "contradictionRisk": _clamp01(
            raw.get("contradictionRisk", fallback["contradictionRisk"])
        ),
        "extractClaims": claims or fallback["extractClaims"],
        "suggestedMove": move if move in MOVES else fallback["suggestedMove"],
        "bestSpeakerDomain": domain if domain in DOMAINS else fallback["bestSpeakerDomain"],
        "threadTopic": str(raw.get("threadTopic") or fallback["threadTopic"])[:120],
        "quoteSnippet": str(raw.get("quoteSnippet") or fallback["quoteSnippet"])[:120],
        "source": "llm",
    }


async def analyze_answer(
    answer: str,
    profile: dict,
    turns: list[dict],
    memory: dict[str, Any],
) -> dict[str, Any]:
    fallback = heuristic_analyze(answer, turns, memory)
    system = (
        "You analyze a candidate's board-interview answer. "
        "Return ONLY a JSON object with keys: specificity (0-1), hedging (0-1), "
        "contradictionRisk (0-1), extractClaims (string[]), suggestedMove "
        "(press|clarify|new_topic|invite_example|bridge_close), "
        "bestSpeakerDomain (chair-daf|subject|affairs-ethics|quiet|skeptic), "
        "threadTopic (short), quoteSnippet (short quote from answer). No markdown."
    )
    user = (
        f"PROFILE:\n{profile}\n\n"
        f"BOARD_MEMORY:\n{memory_prompt_block(memory)}\n\n"
        f"RECENT:\n{turns[-8:]}\n\n"
        f"LAST_ANSWER:\n{answer}"
    )
    text = await board_chat(system, user, temperature=0.2, timeout_seconds=25.0)
    parsed = extract_json_object(text)
    if not parsed:
        return fallback
    return _normalize(parsed, fallback)


def move_is_follow_up(move: str) -> bool:
    return move in ("press", "clarify", "invite_example")
