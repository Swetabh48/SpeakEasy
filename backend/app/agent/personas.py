from __future__ import annotations

from dataclasses import dataclass
import hashlib
from typing import Any


@dataclass(frozen=True)
class PanelPersona:
    id: str
    name: str
    role: str
    domain: str  # chair-daf | subject | affairs-ethics | quiet | skeptic
    tone: str
    speaking_style: str
    categories: tuple[str, ...]


# Keep IDs in sync with frontend `src/lib/boardPanel.ts`
PANEL: list[PanelPersona] = [
    PanelPersona(
        id="chair",
        name="Dr. Mehta",
        role="Chairperson",
        domain="chair-daf",
        tone="calm, warm, clear — never cryptic; runs a natural conversation",
        speaking_style=(
            "Opens and closes the board. Speaks in full plain sentences. "
            "Thanks the candidate briefly, then asks one clear DAF / hometown / hobby / motivation question. "
            "No jargon traps in the opening."
        ),
        categories=("welcome", "daf", "hobby", "close"),
    ),
    PanelPersona(
        id="member-a",
        name="Ms. Iyer",
        role="Subject member",
        domain="subject",
        tone="sharp but fair; explains what she wants before pressing",
        speaking_style=(
            "Owns optional / branch questions. States the scenario clearly, then asks what the candidate would do."
        ),
        categories=("optional-subject", "technical"),
    ),
    PanelPersona(
        id="member-b",
        name="Prof. Khan",
        role="Generalist",
        domain="affairs-ethics",
        tone="steady, thoughtful, occasionally dry humour",
        speaking_style=(
            "Ethics and current affairs as short stories: set the scene, then one clear decision question."
        ),
        categories=("current-affairs", "ethics"),
    ),
    PanelPersona(
        id="member-c",
        name="Mr. Rao",
        role="Member",
        domain="quiet",
        tone="soft-spoken, suddenly pointed, lightly teasing",
        speaking_style=(
            "Mostly quiet; when he speaks, one personal question that feels like a friendly trap."
        ),
        categories=("personality", "daf"),
    ),
    PanelPersona(
        id="member-d",
        name="Dr. Sen",
        role="Skeptic",
        domain="skeptic",
        tone="arrogant, witty, occasionally funny — still crystal clear",
        speaking_style=(
            "Counters with a smile. Never cryptic one-liners. "
            "Says what he disagrees with, then asks the candidate to defend. Aggressive but understandable."
        ),
        categories=("ethics", "follow-up", "personality"),
    ),
]

BY_ID = {p.id: p for p in PANEL}
SKEPTIC = BY_ID["member-d"]
CHAIR = BY_ID["chair"]

DOMAIN_TO_ID = {
    "chair-daf": "chair",
    "subject": "member-a",
    "affairs-ethics": "member-b",
    "quiet": "member-c",
    "skeptic": "member-d",
}


def _hash_ratio(seed: str) -> float:
    h = int(hashlib.sha256(seed.encode("utf-8")).hexdigest(), 16)
    return (h % 10000) / 10000.0


def infer_category(
    profile: dict,
    board_n: int,
    grounding: str | None,
    is_follow_up: bool,
    move: str | None = None,
    memory: dict[str, Any] | None = None,
) -> str:
    if is_follow_up:
        return "follow-up"
    if board_n == 0:
        return "welcome"
    if move == "bridge_close" or (
        memory and float(memory.get("pressureLevel") or 0) > 0.85 and board_n >= 7
    ):
        return "close"
    if grounding:
        return "current-affairs"
    if board_n <= 2:
        return "daf"

    if memory:
        cov = memory.get("dafCoverage") or {}
        if cov.get("hobbies") == "none" and board_n >= 3:
            return "hobby"
        if cov.get("optionalOrTech") == "none" and (
            profile.get("optionalSubject") or profile.get("engineeringBranch")
        ):
            return "optional-subject" if profile.get("optionalSubject") else "technical"

    optional = profile.get("optionalSubject") or ""
    branch = profile.get("engineeringBranch") or ""
    track = profile.get("track") or ""
    seed = f"{profile.get('name')}|{board_n}|cat"
    r = _hash_ratio(seed)
    if (optional or branch or track == "psu-technical") and r < 0.35:
        return "optional-subject" if optional else "technical"
    if r < 0.55:
        return "ethics"
    if r < 0.72:
        return "current-affairs"
    if r < 0.85:
        return "hobby"
    return "personality"


def pick_persona(
    *,
    profile: dict,
    turns: list[dict],
    category: str,
    is_follow_up: bool,
    force_skeptic: bool = False,
    analysis: dict[str, Any] | None = None,
    memory: dict[str, Any] | None = None,
) -> PanelPersona:
    """Route the next utterance to the panelist whose domain / thread fits."""
    board_n = sum(1 for t in turns if t.get("role") == "board")
    seed = f"{profile.get('name')}|{board_n}|{category}|{is_follow_up}"

    if board_n == 0 or category == "welcome":
        return CHAIR
    if category == "close":
        return CHAIR

    if is_follow_up and memory and memory.get("openThreads"):
        thread = memory["openThreads"][-1]
        if _hash_ratio(seed + "|esc") < 0.35:
            return SKEPTIC
        owner = thread.get("ownerSpeakerId")
        if owner in BY_ID:
            return BY_ID[owner]

    if force_skeptic or (is_follow_up and _hash_ratio(seed + "|sk") < 0.35):
        return SKEPTIC

    if is_follow_up:
        domain = (analysis or {}).get("bestSpeakerDomain")
        if domain in DOMAIN_TO_ID and _hash_ratio(seed + "|dom") < 0.7:
            return BY_ID[DOMAIN_TO_ID[domain]]
        last_board = next(
            (t for t in reversed(turns) if t.get("role") == "board"),
            None,
        )
        prev_id = (last_board or {}).get("speakerId")
        if prev_id and prev_id in BY_ID and prev_id != "member-c":
            if _hash_ratio(seed + "|esc") < 0.4:
                return SKEPTIC
            return BY_ID[prev_id]
        return SKEPTIC

    if category in ("daf", "hobby"):
        return CHAIR
    if category in ("optional-subject", "technical"):
        return BY_ID["member-a"]
    if category in ("current-affairs", "ethics"):
        if category == "ethics" and _hash_ratio(seed + "|eth") < 0.22:
            return SKEPTIC
        return BY_ID["member-b"]

    if board_n >= 4 and _hash_ratio(seed + "|quiet") < 0.18:
        return BY_ID["member-c"]

    if category == "personality":
        return BY_ID["member-c"] if _hash_ratio(seed) < 0.55 else SKEPTIC

    return CHAIR


def persona_prompt_block(
    persona: PanelPersona,
    memory: dict[str, Any] | None = None,
) -> str:
    note = ""
    if memory:
        notes = memory.get("memberNotes") or {}
        if notes.get(persona.id):
            note = f"Your private note from earlier: {notes[persona.id]}\n"
    return (
        f"You are {persona.name}, {persona.role} on an Indian government interview board.\n"
        f"Domain: {persona.domain}. Tone: {persona.tone}.\n"
        f"Style: {persona.speaking_style}\n"
        "Speak as this member only. One clear spoken turn — natural conversation, not a riddle.\n"
        "No cryptic slogans. No labels like 'Question:'. Prefer 1–3 plain sentences.\n"
        f"{note}"
    )
