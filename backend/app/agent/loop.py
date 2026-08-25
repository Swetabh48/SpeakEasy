from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.agent import generator, planner, tools
from app.agent.followup import should_follow_up
from app.agent.personas import infer_category, pick_persona
from app.config import get_settings
from app.models import BoardSession, BoardTurn, CandidateProfile, ToolCallLog


@dataclass
class ToolTrace:
    tool_name: str
    query: str | None
    result_snippet: str | None
    used_in_question: bool


@dataclass
class QuestionResult:
    turn: BoardTurn
    trace: ToolTrace | None
    speaker_id: str
    speaker_name: str
    category: str
    is_follow_up: bool


def _profile_dict(profile: CandidateProfile) -> dict:
    return {
        "name": profile.name,
        "homeState": profile.home_state,
        "education": profile.education,
        "optionalSubject": profile.optional_subject,
        "engineeringBranch": profile.engineering_branch,
        "workExperience": profile.work_experience,
        "hobbies": profile.hobbies or [],
        "servicePreferences": profile.service_preferences or [],
        "track": profile.track,
    }


def _turns_dicts(turns: list[BoardTurn]) -> list[dict]:
    return [
        {
            "role": t.role,
            "text": t.text,
            "speakerId": getattr(t, "speaker_id", None),
            "category": getattr(t, "category", None),
            "isFollowUp": bool(getattr(t, "is_follow_up", False)),
        }
        for t in turns
    ]


async def next_question(
    db: Session,
    session: BoardSession,
    profile: CandidateProfile,
) -> QuestionResult:
    turns = list(session.turns)
    profile_data = _profile_dict(profile)
    turn_data = _turns_dicts(turns)

    last_answer = next(
        (t for t in reversed(turns) if t.role == "candidate"),
        None,
    )
    is_follow = bool(
        last_answer and should_follow_up(last_answer.text, turn_data)
    )

    trace: ToolTrace | None = None
    grounding: str | None = None
    settings = get_settings()
    board_n = sum(1 for t in turns if t.role == "board")

    # Skip slow planner/LLM/tools in fast mode — keep the room conversational
    if not is_follow and not settings.board_fast_mode:
        plan = await planner.decide(profile_data, turn_data)
        if plan.needs_tool:
            result = await tools.current_affairs_lookup(plan.topic)
            grounding = result.summary
            trace = ToolTrace(
                tool_name="current_affairs_lookup",
                query=plan.topic,
                result_snippet=result.summary[:800],
                used_in_question=True,
            )

    category = infer_category(
        profile_data, board_n, grounding, is_follow
    )
    persona = pick_persona(
        profile=profile_data,
        turns=turn_data,
        category=category,
        is_follow_up=is_follow,
    )

    question = await generator.generate(
        profile_data,
        turn_data,
        grounding,
        persona=persona,
        category=category,
        is_follow_up=is_follow,
        last_answer=last_answer.text if last_answer else None,
    )

    board_turn = BoardTurn(
        session_id=session.id,
        role="board",
        text=question,
        speaker_id=persona.id,
        category=category,
        is_follow_up=is_follow,
    )
    db.add(board_turn)
    db.flush()

    if trace:
        db.add(
            ToolCallLog(
                session_id=session.id,
                turn_id=board_turn.id,
                tool_name=trace.tool_name,
                query=trace.query,
                result_snippet=trace.result_snippet,
                used_in_question=trace.used_in_question,
            )
        )

    db.commit()
    db.refresh(board_turn)
    return QuestionResult(
        turn=board_turn,
        trace=trace,
        speaker_id=persona.id,
        speaker_name=persona.name,
        category=category,
        is_follow_up=is_follow,
    )
