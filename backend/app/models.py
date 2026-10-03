from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    home_state: Mapped[str] = mapped_column(String(120), nullable=False)
    education: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    optional_subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    engineering_branch: Mapped[str | None] = mapped_column(String(200), nullable=True)
    work_experience: Mapped[str | None] = mapped_column(Text, nullable=True)
    hobbies: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    service_preferences: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    track: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions: Mapped[list[BoardSession]] = relationship(back_populates="profile")


class BoardSession(Base):
    __tablename__ = "board_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("candidate_profiles.id"), nullable=False
    )
    track: Mapped[str] = mapped_column(String(64), nullable=False)
    memory_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    profile: Mapped[CandidateProfile] = relationship(back_populates="sessions")
    turns: Mapped[list[BoardTurn]] = relationship(back_populates="session", order_by="BoardTurn.created_at")
    violations: Mapped[list[ViolationEvent]] = relationship(back_populates="session")
    tool_logs: Mapped[list[ToolCallLog]] = relationship(back_populates="session")


class BoardTurn(Base):
    __tablename__ = "board_turns"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("board_sessions.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # board | candidate
    text: Mapped[str] = mapped_column(Text, nullable=False)
    speaker_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_follow_up: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[BoardSession] = relationship(back_populates="turns")


class ViolationEvent(Base):
    __tablename__ = "violation_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("board_sessions.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    at_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped[BoardSession] = relationship(back_populates="violations")


class ToolCallLog(Base):
    __tablename__ = "tool_call_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("board_sessions.id"), nullable=False
    )
    turn_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("board_turns.id"), nullable=True
    )
    tool_name: Mapped[str] = mapped_column(String(120), nullable=False)
    query: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    used_in_question: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[BoardSession] = relationship(back_populates="tool_logs")


class EvalCase(Base):
    __tablename__ = "eval_cases"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    profile_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    track: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EvalRun(Base):
    __tablename__ = "eval_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    prompt_version: Mapped[str] = mapped_column(String(64), nullable=False)
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    scores: Mapped[list[EvalScore]] = relationship(back_populates="run")


class EvalScore(Base):
    __tablename__ = "eval_scores"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("eval_runs.id"), nullable=False)
    case_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("eval_cases.id"), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    profile_reference_score: Mapped[float] = mapped_column(nullable=False, default=0.0)
    repetition_score: Mapped[float] = mapped_column(nullable=False, default=0.0)
    grounding_score: Mapped[float] = mapped_column(nullable=False, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    run: Mapped[EvalRun] = relationship(back_populates="scores")

