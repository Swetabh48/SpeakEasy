"""
Offline gates for conversational board (heuristic path, no LLM required).

  cd backend
  python -m app.eval.test_conversation_gates
"""

from __future__ import annotations

from app.agent.analyze import heuristic_analyze, move_is_follow_up
from app.agent.memory import apply_analysis_to_memory, empty_board_memory
from app.agent.personas import infer_category, pick_persona
from app.agent.generator import _fallback_follow_up


def _content_overlap(a: str, b: str) -> int:
    stop = {"that", "this", "with", "would", "have", "from", "your", "about"}
    ta = {w for w in a.lower().split() if len(w) >= 4 and w not in stop}
    tb = {w for w in b.lower().split() if len(w) >= 4 and w not in stop}
    return len(ta & tb)


def main() -> None:
    profile = {
        "name": "Vikram Das",
        "homeState": "West Bengal",
        "optionalSubject": "Political Science",
        "education": {"degree": "BA", "institution": "X", "year": 2020},
        "hobbies": ["debate"],
        "track": "upsc-cse",
    }
    memory = empty_board_memory()
    turns = [
        {
            "role": "board",
            "text": "Good morning, Vikram. Introduce yourself.",
            "speakerId": "chair",
            "category": "welcome",
            "isFollowUp": False,
        }
    ]
    answer = (
        "I think maybe various things overall synergy going forward about administration."
    )
    turns.append({"role": "candidate", "text": answer})

    analysis = heuristic_analyze(answer, turns, memory)
    assert move_is_follow_up(analysis["suggestedMove"]), analysis
    is_follow = True
    category = infer_category(profile, 1, None, is_follow, analysis["suggestedMove"], memory)
    persona = pick_persona(
        profile=profile,
        turns=turns,
        category=category,
        is_follow_up=True,
        analysis=analysis,
        memory=memory,
    )
    # After applying analysis once with chair as prior owner of thread:
    memory = apply_analysis_to_memory(memory, analysis, "chair", category)
    persona2 = pick_persona(
        profile=profile,
        turns=turns,
        category="follow-up",
        is_follow_up=True,
        analysis=analysis,
        memory=memory,
    )
    assert persona2.id in ("chair", "member-d"), persona2.id

    q = _fallback_follow_up(profile, turns, persona, answer)
    assert _content_overlap(q, answer) >= 1 or '"' in q, q

    # No identical prefix across two fallback presses with different snippets
    q2 = _fallback_follow_up(
        profile,
        turns,
        persona,
        "Document the refusal and brief the collector in West Bengal immediately.",
    )
    assert q.lower()[:40] != q2.lower()[:40], (q, q2)

    print("OK conversation gates (heuristic)")


if __name__ == "__main__":
    main()
