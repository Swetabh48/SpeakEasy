from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agent.debrief import build_debrief
from app.agent.loop import next_question
from app.agent.memory import empty_board_memory
from app.db import get_db
from app.models import BoardSession, BoardTurn, CandidateProfile, ViolationEvent
from app.schemas import (
    CreateSessionRequest,
    CreateSessionResponse,
    DebriefRequest,
    DebriefResponse,
    NextQuestionRequest,
    NextQuestionResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    ToolTraceOut,
)

router = APIRouter(prefix="/board", tags=["board"])


@router.post("/session", response_model=CreateSessionResponse)
def create_session(body: CreateSessionRequest, db: Session = Depends(get_db)):
    p = body.profile
    education = p.education.model_dump()
    if p.dafUploadNotes:
        education["dafUploadNotes"] = p.dafUploadNotes[:6000]
    profile = CandidateProfile(
        name=p.name.strip(),
        home_state=p.homeState.strip(),
        education=education,
        optional_subject=p.optionalSubject,
        engineering_branch=p.engineeringBranch,
        work_experience=p.workExperience,
        hobbies=p.hobbies,
        service_preferences=p.servicePreferences,
        track=p.track,
    )
    db.add(profile)
    db.flush()
    session = BoardSession(
        profile_id=profile.id,
        track=p.track,
        memory_json=empty_board_memory(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return CreateSessionResponse(
        sessionId=session.id,
        profileId=profile.id,
        track=p.track,  # type: ignore[arg-type]
        startedAt=session.started_at,
    )


@router.post("/question", response_model=NextQuestionResponse)
async def ask_question(body: NextQuestionRequest, db: Session = Depends(get_db)):
    session = db.get(BoardSession, body.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    profile = db.get(CandidateProfile, session.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    result = await next_question(db, session, profile)
    turn = result.turn
    trace_out = None
    if result.trace:
        trace_out = ToolTraceOut(
            toolName=result.trace.tool_name,
            query=result.trace.query,
            resultSnippet=result.trace.result_snippet,
            usedInQuestion=result.trace.used_in_question,
        )
    return NextQuestionResponse(
        turnId=turn.id,
        question=turn.text,
        speakerId=result.speaker_id,
        speakerName=result.speaker_name,
        category=result.category,
        isFollowUp=result.is_follow_up,
        llmSource=result.llm_source,
        memory=session.memory_json or None,
        trace=trace_out,
    )


@router.post("/answer", response_model=SubmitAnswerResponse)
def submit_answer(body: SubmitAnswerRequest, db: Session = Depends(get_db)):
    session = db.get(BoardSession, body.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty answer")

    turn = BoardTurn(session_id=session.id, role="candidate", text=text)
    db.add(turn)
    db.flush()

    for v in body.violations:
        kind = str(v.get("kind") or "")
        at_ms = int(v.get("atMs") or v.get("at_ms") or 0)
        if kind:
            db.add(ViolationEvent(session_id=session.id, kind=kind, at_ms=at_ms))

    db.commit()
    db.refresh(turn)
    return SubmitAnswerResponse(turnId=turn.id, accepted=True)


@router.post("/debrief", response_model=DebriefResponse)
def debrief_session(body: DebriefRequest, db: Session = Depends(get_db)):
    session = db.get(BoardSession, body.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    profile = db.get(CandidateProfile, session.profile_id)

    if body.turns:
        turns = body.turns
    else:
        turns = [
            {
                "role": t.role,
                "text": t.text,
                "speakerId": t.speaker_id,
                "category": t.category,
                "isFollowUp": t.is_follow_up,
                "speakerName": None,
            }
            for t in session.turns
        ]
        # Fill speaker names from known personas
        from app.agent.personas import BY_ID

        for t in turns:
            sid = t.get("speakerId")
            if sid and sid in BY_ID:
                t["speakerName"] = BY_ID[sid].name

    violations = body.violations or [
        {"kind": v.kind, "atMs": v.at_ms} for v in session.violations
    ]
    profile_dict = None
    if profile:
        profile_dict = {
            "name": profile.name,
            "homeState": profile.home_state,
            "optionalSubject": profile.optional_subject,
            "track": profile.track,
        }
    data = build_debrief(
        turns=turns,
        violations=violations,
        profile=profile_dict,
        memory=session.memory_json or None,
    )
    return DebriefResponse(**data)


@router.get("/session/{session_id}/turns")
def list_turns(session_id: UUID, db: Session = Depends(get_db)):
    session = db.get(BoardSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return [
        {
            "id": str(t.id),
            "role": t.role,
            "text": t.text,
            "speakerId": t.speaker_id,
            "category": t.category,
            "isFollowUp": t.is_follow_up,
            "createdAt": t.created_at.isoformat(),
        }
        for t in session.turns
    ]
