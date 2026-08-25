from __future__ import annotations

from dataclasses import dataclass

from app.agent.ollama_client import extract_json_object, ollama_chat


@dataclass
class PlanDecision:
    needs_tool: bool
    topic: str | None = None


PLANNER_SYSTEM = """You are the orchestrator for an Indian government personality-test board
(UPSC CSE / IES / IFS / PSU viva).

Decide if the NEXT spoken question needs fresh current-affairs grounding via a tool.
Return ONLY JSON: {"needs_tool": true|false, "topic": "short topic or null"}

Rules:
- Opening turns (early interview): needs_tool=false — welcome and DAF first.
- Mid/late: needs_tool=true when a live affairs angle would make a better dilemma.
- Pure DAF / hobby / motivation / personal ethics: needs_tool=false.
- topic must be a short searchable phrase when needs_tool is true."""


async def decide(profile: dict, turns: list[dict]) -> PlanDecision:
    board_n = sum(1 for t in turns if t.get("role") == "board")
    # Real boards rarely start with current-affairs traps in the opening minutes
    if board_n < 3:
        return PlanDecision(needs_tool=False, topic=None)

    user = (
        f"PROFILE:\n{profile}\n\n"
        f"BOARD_TURN_INDEX={board_n}\n"
        f"RECENT_TURNS:\n{turns[-8:]}\n\n"
        "Decide grounding need for the next question as the board orchestrator."
    )
    text = await ollama_chat(PLANNER_SYSTEM, user, temperature=0.1)
    data = extract_json_object(text) or {}
    needs = bool(data.get("needs_tool"))
    topic = data.get("topic")
    if isinstance(topic, str):
        topic = topic.strip() or None
    else:
        topic = None
    if not text:
        needs = board_n > 0 and board_n % 3 == 0
        topic = profile.get("optionalSubject") or profile.get("homeState") or "India governance"
    return PlanDecision(needs_tool=needs, topic=topic)
