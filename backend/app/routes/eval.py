from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agent import generator, planner, tools
from app.agent.analyze import analyze_answer, move_is_follow_up
from app.agent.memory import apply_analysis_to_memory, empty_board_memory
from app.agent.personas import infer_category, pick_persona
from app.config import get_settings
from app.db import get_db
from app.models import EvalCase, EvalRun, EvalScore
from app.schemas import EvalRunRequest, EvalRunResponse

router = APIRouter(prefix="/eval", tags=["eval"])

CASES_DIR = Path(__file__).resolve().parents[1] / "eval" / "cases"
STOP = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "is",
    "are",
    "was",
    "i",
    "we",
    "you",
    "my",
    "that",
    "this",
    "with",
    "would",
    "be",
}


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
        return 1.0
    if not grounding:
        return 0.0
    q = question.lower()
    g_tokens = [w for w in grounding.lower().replace("\n", " ").split() if len(w) > 4][:40]
    if not g_tokens:
        return 0.0
    hits = sum(1 for t in g_tokens if t in q)
    return min(1.0, hits / 3.0)


def _content_tokens(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z]{4,}", (text or "").lower())
    return {w for w in words if w not in STOP}


def _answer_reference_score(question: str, last_answer: str | None, is_follow: bool) -> float:
    """Follow-ups should reuse content tokens from the candidate answer."""
    if not is_follow or not last_answer:
        return 1.0
    q_tok = _content_tokens(question)
    a_tok = _content_tokens(last_answer)
    if not a_tok or not q_tok:
        return 0.0
    overlap = len(q_tok & a_tok)
    return min(1.0, overlap / 2.0)


def _speaker_continuity_ok(
    is_follow: bool,
    persona_id: str,
    prev_speaker: str | None,
    memory: dict,
) -> bool:
    if not is_follow:
        return True
    threads = memory.get("openThreads") or []
    if threads:
        owner = threads[-1].get("ownerSpeakerId")
        return persona_id in (owner, "member-d")
    if prev_speaker:
        return persona_id in (prev_speaker, "member-d")
    return True


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
    gate_notes: list[str] = []
    for case in cases:
        profile = case.profile_json
        turns: list[dict] = []
        prior_questions: list[str] = []
        memory = empty_board_memory()
        for _ in range(q_per):
            last_ans = next(
                (t for t in reversed(turns) if t.get("role") == "candidate"),
                None,
            )
            analysis = None
            if last_ans:
                analysis = await analyze_answer(
                    last_ans["text"], profile, turns, memory
                )
            is_follow = bool(
                analysis and move_is_follow_up(str(analysis.get("suggestedMove") or ""))
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
            category = infer_category(
                profile,
                board_n,
                grounding,
                is_follow,
                move=str((analysis or {}).get("suggestedMove") or "") or None,
                memory=memory,
            )
            prev_speaker = next(
                (
                    t.get("speakerId")
                    for t in reversed(turns)
                    if t.get("role") == "board"
                ),
                None,
            )
            persona = pick_persona(
                profile=profile,
                turns=turns,
                category=category,
                is_follow_up=is_follow,
                analysis=analysis,
                memory=memory,
            )
            question = await generator.generate(
                profile,
                turns,
                grounding,
                persona=persona,
                category=category,
                is_follow_up=is_follow,
                last_answer=last_ans["text"] if last_ans else None,
                memory=memory,
                analysis=analysis,
            )

            # Soft gates (recorded in notes; scores stay numeric)
            ans_ref = _answer_reference_score(
                question, last_ans["text"] if last_ans else None, is_follow
            )
            cont = _speaker_continuity_ok(
                is_follow, persona.id, prev_speaker, memory
            )
            prefix_dup = any(
                p and question.lower()[:40] == p.lower()[:40] for p in prior_questions
            )
            if is_follow and ans_ref < 0.5:
                gate_notes.append(f"{case.name}: weak answer-reference on follow-up")
            if is_follow and not cont:
                gate_notes.append(f"{case.name}: speaker continuity break")
            if prefix_dup:
                gate_notes.append(f"{case.name}: identical question prefix")

            if analysis:
                memory = apply_analysis_to_memory(
                    memory, analysis, persona.id, category
                )

            db.add(
                EvalScore(
                    run_id=run.id,
                    case_id=case.id,
                    question_text=question,
                    profile_reference_score=_profile_reference_score(question, profile),
                    repetition_score=_repetition_score(question, prior_questions)
                    * (0.0 if prefix_dup else 1.0),
                    grounding_score=(
                        _grounding_score(question, grounding, used_tool) * 0.7
                        + ans_ref * 0.3
                    ),
                    notes=(
                        f"tool={used_tool}; topic={plan_topic}; "
                        f"persona={persona.id}; cat={category}; follow={is_follow}; "
                        f"ansRef={ans_ref:.2f}; continuity={cont}"
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
            stub = (
                "I think maybe various things overall synergy going forward."
                if score_count % 3 == 0
                else (
                    f"In my optional and work in {profile.get('homeState', 'my state')}, "
                    "I would apply the rule first, document the refusal, and brief my collector."
                )
            )
            turns.append({"role": "candidate", "text": stub})

    if gate_notes:
        run.notes = (run.notes or "") + " | gates: " + "; ".join(gate_notes[:12])
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
                    "profileReference": round(
                        sum(s.profile_reference_score for s in scores) / n, 3
                    ),
                    "repetition": round(sum(s.repetition_score for s in scores) / n, 3),
                    "grounding": round(sum(s.grounding_score for s in scores) / n, 3),
                },
                "scoreCount": len(scores),
            }
        )
    return out
