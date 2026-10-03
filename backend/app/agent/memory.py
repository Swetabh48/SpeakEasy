from __future__ import annotations

from copy import deepcopy
from typing import Any, Literal

BoardMove = Literal["press", "clarify", "new_topic", "invite_example", "bridge_close"]
Coverage = Literal["none", "thin", "probed"]

DAF_KEYS = (
    "hometown",
    "education",
    "optionalOrTech",
    "work",
    "hobbies",
    "motivation",
)


def empty_board_memory() -> dict[str, Any]:
    return {
        "claims": [],
        "openThreads": [],
        "dafCoverage": {k: "none" for k in DAF_KEYS},
        "pressureLevel": 0.2,
        "memberNotes": {},
    }


def memory_prompt_block(memory: dict[str, Any]) -> str:
    threads = memory.get("openThreads") or []
    claims = memory.get("claims") or []
    notes = memory.get("memberNotes") or {}
    thread_lines = "\n".join(
        f"- [{t.get('ownerSpeakerId')}] {t.get('topic')}: {t.get('whyOpen')}"
        for t in threads[:4]
    )
    claim_lines = "\n".join(f"- {c}" for c in claims[-8:])
    note_lines = "\n".join(f"- {k}: {v}" for k, v in notes.items())
    return (
        f"PRESSURE={float(memory.get('pressureLevel') or 0):.2f}\n"
        f"DAF_COVERAGE={memory.get('dafCoverage')}\n"
        f"CLAIMS:\n{claim_lines or '(none)'}\n"
        f"OPEN_THREADS:\n{thread_lines or '(none)'}\n"
        f"MEMBER_NOTES:\n{note_lines or '(none)'}"
    )


def _bump(current: str, level: Coverage) -> str:
    if current == "probed":
        return "probed"
    if level == "probed":
        return "probed"
    if current == "thin":
        return "thin"
    return level


def apply_analysis_to_memory(
    memory: dict[str, Any],
    analysis: dict[str, Any],
    speaker_id: str,
    category: str,
) -> dict[str, Any]:
    next_m = deepcopy(memory) if memory else empty_board_memory()
    claims = list(next_m.get("claims") or [])
    for c in analysis.get("extractClaims") or []:
        clean = str(c).strip()[:160]
        if clean and clean not in claims:
            claims.append(clean)
    next_m["claims"] = claims[-16:]

    move = analysis.get("suggestedMove") or "new_topic"
    topic = str(analysis.get("threadTopic") or "")[:120]
    threads = list(next_m.get("openThreads") or [])
    if move in ("press", "clarify", "invite_example") and topic:
        existing = next(
            (t for t in threads if str(t.get("topic", "")).lower() == topic.lower()),
            None,
        )
        if existing:
            existing["ownerSpeakerId"] = speaker_id
            existing["whyOpen"] = f"{move}: needs more specificity"
        else:
            threads.append(
                {
                    "topic": topic,
                    "ownerSpeakerId": speaker_id,
                    "whyOpen": f"{move} — candidate was thin/hedged",
                }
            )
    elif move in ("new_topic", "bridge_close"):
        threads = [t for t in threads if t.get("ownerSpeakerId") != speaker_id]
    next_m["openThreads"] = threads[-6:]

    cov = dict(next_m.get("dafCoverage") or {})
    level: Coverage = "probed" if float(analysis.get("specificity") or 0) >= 0.55 else "thin"
    cat = (category or "").lower()
    if "welcome" in cat or "daf" in cat or "hobby" in cat:
        cov["hometown"] = _bump(cov.get("hometown", "none"), level)
        cov["motivation"] = _bump(cov.get("motivation", "none"), "thin")
    if "hobby" in cat:
        cov["hobbies"] = _bump(cov.get("hobbies", "none"), level)
    if "optional" in cat or "technical" in cat:
        cov["optionalOrTech"] = _bump(cov.get("optionalOrTech", "none"), level)
    next_m["dafCoverage"] = cov

    delta = 0.12 if move in ("press", "clarify") else 0.08 if move == "invite_example" else -0.06
    pressure = float(next_m.get("pressureLevel") or 0.2) + delta
    next_m["pressureLevel"] = min(0.95, max(0.1, pressure))

    quote = str(analysis.get("quoteSnippet") or "")[:80]
    notes = dict(next_m.get("memberNotes") or {})
    notes[speaker_id] = (
        f'Candidate said roughly: "{quote}". Move={move}.'
        if quote
        else f"Last move={move}"
    )
    next_m["memberNotes"] = notes
    return next_m


def thin_daf_fields(memory: dict[str, Any]) -> list[str]:
    cov = memory.get("dafCoverage") or {}
    return [k for k, v in cov.items() if v in ("none", "thin")]
