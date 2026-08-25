from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

ServiceTrack = Literal["upsc-cse", "ies-ese", "ifs", "psu-technical"]
TurnRole = Literal["board", "candidate"]
ViolationKind = Literal[
    "no-face",
    "multi-face",
    "gaze-away",
    "head-turned",
    "too-close",
    "tab-switch",
    "fullscreen-exit",
    "phone-detected",
    "conduct-abuse",
]


class EducationIn(BaseModel):
    degree: str
    institution: str
    year: int


class CandidateProfileIn(BaseModel):
    name: str
    homeState: str
    education: EducationIn
    optionalSubject: str | None = None
    engineeringBranch: str | None = None
    workExperience: str | None = None
    hobbies: list[str] = Field(default_factory=list)
    servicePreferences: list[str] = Field(default_factory=list)
    track: ServiceTrack
    dafUploadNotes: str | None = None


class CandidateProfileOut(CandidateProfileIn):
    id: UUID
    createdAt: datetime


class CreateSessionRequest(BaseModel):
    profile: CandidateProfileIn


class CreateSessionResponse(BaseModel):
    sessionId: UUID
    profileId: UUID
    track: ServiceTrack
    startedAt: datetime


class BoardTurnOut(BaseModel):
    id: UUID
    role: TurnRole
    text: str
    createdAt: datetime


class ToolTraceOut(BaseModel):
    toolName: str
    query: str | None = None
    resultSnippet: str | None = None
    usedInQuestion: bool = False


class NextQuestionRequest(BaseModel):
    sessionId: UUID


class NextQuestionResponse(BaseModel):
    turnId: UUID
    question: str
    speakerId: str | None = None
    speakerName: str | None = None
    category: str | None = None
    isFollowUp: bool = False
    trace: ToolTraceOut | None = None


class SubmitAnswerRequest(BaseModel):
    sessionId: UUID
    text: str
    violations: list[dict[str, Any]] = Field(default_factory=list)


class SubmitAnswerResponse(BaseModel):
    turnId: UUID
    accepted: bool = True


class DebriefRequest(BaseModel):
    sessionId: UUID
    # Optional client-side turns if session was mostly local; otherwise server uses DB
    turns: list[dict[str, Any]] | None = None
    violations: list[dict[str, Any]] = Field(default_factory=list)


class DebriefResponse(BaseModel):
    candidateName: str
    questionCount: int
    answerCount: int
    categoryCoverage: list[str]
    boardReport: dict[str, Any]
    disciplineReport: dict[str, Any]


class EvalRunRequest(BaseModel):
    notes: str | None = None
    questionsPerCase: int = 5
    # Use 20+ for a slower full-length pass (topic-drift / follow-up regressions)
    fullLength: bool = False


class EvalRunResponse(BaseModel):
    runId: UUID
    promptVersion: str
    modelName: str
    caseCount: int
    scoreCount: int


class HealthResponse(BaseModel):
    status: str
    service: str = "speakeasy-board-api"
