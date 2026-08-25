from __future__ import annotations

from dataclasses import dataclass
import hashlib


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


def _hash_ratio(seed: str) -> float:
    h = int(hashlib.sha256(seed.encode("utf-8")).hexdigest(), 16)
    return (h % 10000) / 10000.0


def infer_category(
    profile: dict,
    board_n: int,
    grounding: str | None,
    is_follow_up: bool,
) -> str:
    if is_follow_up:
        return "follow-up"
    if board_n == 0:
        return "welcome"
    if grounding:
        return "current-affairs"
    if board_n <= 2:
        return "daf"
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
) -> PanelPersona:
    """Route the next utterance to the panelist whose domain fits."""
    board_n = sum(1 for t in turns if t.get("role") == "board")
    seed = f"{profile.get('name')}|{board_n}|{category}|{is_follow_up}"

    if board_n == 0 or category == "welcome":
        return CHAIR

    if force_skeptic or (category == "follow-up" and _hash_ratio(seed + "|sk") < 0.35):
        return SKEPTIC

    if is_follow_up:
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

    if category in ("daf", "hobby", "close"):
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


def persona_prompt_block(persona: PanelPersona) -> str:
    return (
        f"You are {persona.name}, {persona.role} on an Indian government interview board.\n"
        f"Domain: {persona.domain}. Tone: {persona.tone}.\n"
        f"Style: {persona.speaking_style}\n"
        "Speak as this member only. One clear spoken turn — natural conversation, not a riddle.\n"
        "No cryptic slogans. No labels like 'Question:'. Prefer 1–3 plain sentences."
    )
