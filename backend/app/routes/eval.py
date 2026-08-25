from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agent import generator, planner, tools
from app.agent.followup import should_follow_up
from app.agent.personas import infer_category, pick_persona
from app.config import get_settings
from app.db import get_db
from app.models import EvalCase, EvalRun, EvalScore
from app.schemas import EvalRunRequest, EvalRunResponse

router = APIRouter(prefix="/eval", tags=["eval"])

CASES_DIR = Path(__file__).resolve().parents[1] / "eval" / "cases"


def _profile_tokens(profile: dict) -> list[str]:
    tokens: list[str] = []
    for key in ("name", "homeState", "optionalSubject", "engineeringBranch"):
        val = profile.get(key)
        if isinstance(val, str) and len(val) > 2:
            tokens.append(val.lower())
    for hobby in profile.get("hobbies") or []:
        if isinstance(hobby, str) and len(hobby) > 2:
            tokens.append(hobby.lower())
    edu = profile.get("education") or {}
    for key in ("degree", "institution"):
        val = edu.get(key)
        if isinstance(val, str) and len(val) > 2:
            tokens.append(val.lower())
    return tokens


def _profile_reference_score(question: str, profile: dict) -> float:
    q = question.lower()
    tokens = _profile_tokens(profile)
    if not tokens:
        return 0.5
    hits = sum(1 for t in tokens if t in q)
    return min(1.0, hits / max(1, min(3, len(tokens))))


def _repetition_score(question: str, prior: list[str]) -> float:
    if not prior:
        return 1.0
    q_words = set(question.lower().split())
    if not q_words:
        return 0.0
    overlaps = []
    for p in prior:
        p_words = set(p.lower().split())
        if not p_words:
            continue
        overlaps.append(len(q_words & p_words) / max(1, len(q_words | p_words)))
    worst = max(overlaps) if overlaps else 0.0
    return max(0.0, 1.0 - worst)


def _grounding_score(question: str, grounding: str | None, used_tool: bool) -> float:
    if not used_tool:
        return 1.0  # N/A — full credit when tool not required
    if not grounding:
        return 0.0
    q = question.lower()
    g_tokens = [w for w in grounding.lower().replace("\n", " ").split() if len(w) > 4][:40]
    if not g_tokens:
        return 0.0
    hits = sum(1 for t in g_tokens if t in q)
    return min(1.0, hits / 3.0)


def _ensure_seed_cases(db: Session) -> None:
    if db.query(EvalCase).count() > 0:
        return
    if not CASES_DIR.exists():
        return
    for path in sorted(CASES_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        db.add(
            EvalCase(
                name=data.get("name") or path.stem,
                profile_json=data.get("profile") or data,
                track=(data.get("profile") or data).get("track") or "upsc-cse",
            )
        )
    db.commit()


@router.post("/run", response_model=EvalRunResponse)
async def run_eval(body: EvalRunRequest, db: Session = Depends(get_db)):
    settings = get_settings()
    _ensure_seed_cases(db)
    cases = db.query(EvalCase).all()
    q_per = 20 if body.fullLength else max(1, body.questionsPerCase)
    run = EvalRun(
        prompt_version=settings.prompt_version,
        model_name=settings.ollama_model,
        notes=(body.notes or "")
        + (f" | fullLength n={q_per}" if body.fullLength else f" | n={q_per}"),
    )
    db.add(run)
    db.flush()

    score_count = 0
    for case in cases:
        profile = case.profile_json
        turns: list[dict] = []
        prior_questions: list[str] = []
        for _ in range(q_per):
            last_ans = next(
                (t for t in reversed(turns) if t.get("role") == "candidate"),
                None,
            )
            is_follow = bool(
                last_ans and should_follow_up(last_ans["text"], turns)
            )
            grounding = None
            used_tool = False
            plan_topic = None
            if not is_follow:
                plan = await planner.decide(profile, turns)
                plan_topic = plan.topic
                if plan.needs_tool:
                    result = await tools.current_affairs_lookup(plan.topic)
                    grounding = result.summary
                    used_tool = True
            board_n = sum(1 for t in turns if t.get("role") == "board")
            category = infer_category(profile, board_n, grounding, is_follow)
            persona = pick_persona(
                profile=profile,
                turns=turns,
                category=category,
                is_follow_up=is_follow,
            )
            question = await generator.generate(
                profile,
                turns,
                grounding,
                persona=persona,
                category=category,
                is_follow_up=is_follow,
                last_answer=last_ans["text"] if last_ans else None,
            )
            db.add(
                EvalScore(
                    run_id=run.id,
                    case_id=case.id,
                    question_text=question,
                    profile_reference_score=_profile_reference_score(question, profile),
                    repetition_score=_repetition_score(question, prior_questions),
                    grounding_score=_grounding_score(question, grounding, used_tool),
                    notes=(
                        f"tool={used_tool}; topic={plan_topic}; "
                        f"persona={persona.id}; cat={category}; follow={is_follow}"
                    ),
                )
            )
            score_count += 1
            prior_questions.append(question)
            turns.append(
                {
                    "role": "board",
                    "text": question,
                    "speakerId": persona.id,
                    "category": category,
                    "isFollowUp": is_follow,
                }
            )
            # Varied stub answers so follow-up heuristics get exercised
            stub = (
                "I think maybe various things overall."
                if score_count % 3 == 0
                else (
                    f"In my optional and work in {profile.get('homeState', 'my state')}, "
                    "I would apply the rule first, document the refusal, and brief my collector."
                )
            )
            turns.append({"role": "candidate", "text": stub})

    db.commit()
    return EvalRunResponse(
        runId=run.id,
        promptVersion=settings.prompt_version,
        modelName=settings.ollama_model,
        caseCount=len(cases),
        scoreCount=score_count,
    )


@router.get("/results")
def eval_results(db: Session = Depends(get_db)):
    runs = db.query(EvalRun).order_by(EvalRun.started_at.desc()).limit(20).all()
    out = []
    for run in runs:
        scores = db.query(EvalScore).filter(EvalScore.run_id == run.id).all()
        n = max(1, len(scores))
        out.append(
            {
                "runId": str(run.id),
                "promptVersion": run.prompt_version,
                "modelName": run.model_name,
                "startedAt": run.started_at.isoformat(),
                "notes": run.notes,
                "averages": {
                    "profileReference": round(sum(s.profile_reference_score for s in scores) / n, 3),
                    "repetition": round(sum(s.repetition_score for s in scores) / n, 3),
                    "grounding": round(sum(s.grounding_score for s in scores) / n, 3),
                },
                "scoreCount": len(scores),
            }
        )
    return out
