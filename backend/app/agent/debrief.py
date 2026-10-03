from __future__ import annotations

import re
from collections import defaultdict

HEDGE_RE = re.compile(
    r"\b(i think|i feel|maybe|perhaps|sort of|kind of|basically|actually|"
    r"you know|i mean|probably|possibly|somewhat)\b",
    re.I,
)


def build_debrief(
    *,
    turns: list[dict],
    violations: list[dict],
    profile: dict | None = None,
    memory: dict | None = None,
) -> dict:
    """
    Structured Board Report + Discipline Report from stored turns.
    Pure post-processing — no new capture.
    """
    board_qs = [t for t in turns if t.get("role") == "board"]
    answers = [t for t in turns if t.get("role") == "candidate"]
    pairs: list[tuple[dict, dict | None]] = []
    ai = 0
    for b in board_qs:
        ans = answers[ai] if ai < len(answers) else None
        if ans:
            ai += 1
        pairs.append((b, ans))

    notes: list[str] = []
    strengths: list[str] = []
    weaknesses: list[str] = []

    # Per-answer length / hedge
    short_idxs: list[int] = []
    long_idxs: list[int] = []
    hedge_dense: list[int] = []
    for i, (bq, ans) in enumerate(pairs, start=1):
        if not ans:
            notes.append(f"Q{i} — no answer recorded.")
            continue
        words = ans.get("text", "").split()
        n = len(words)
        hedges = len(HEDGE_RE.findall(ans.get("text", "")))
        density = hedges / max(1, n)
        if n < 18:
            short_idxs.append(i)
            weaknesses.append(
                f"Q{i} — one-line / very short answer "
                f"({n} words); boards usually want elaboration."
            )
        elif n > 180:
            long_idxs.append(i)
            weaknesses.append(
                f"Q{i} — long answer ({n} words); practice tighter structure "
                f"(point → example → close)."
            )
        if density >= 0.04 and hedges >= 3:
            hedge_dense.append(i)
            weaknesses.append(
                f"Q{i} — high hedge density (~{hedges} hedges in {n} words). "
                f"Prefer clearer commitments."
            )
        if ans.get("text") and n >= 40 and hedges <= 1:
            strengths.append(f"Q{i} — reasonably developed answer with few hedges.")

        if bq.get("isFollowUp"):
            notes.append(
                f"Q{i} — cross-question from "
                f"{bq.get('speakerName') or 'panel'} "
                f"(pressed previous answer)."
            )

    # DAF consistency: shared content words across distant Qs
    _daf_cross_check(pairs, notes, weaknesses)

    # Category coverage
    by_cat: dict[str, int] = defaultdict(int)
    for b, _ in pairs:
        cat = b.get("category") or "uncategorized"
        by_cat[cat] += 1
    coverage = [
        f"{cat}: {count} question(s)" for cat, count in sorted(by_cat.items())
    ]

    if short_idxs:
        notes.append(
            f"Short answers on Q{', Q'.join(map(str, short_idxs))} — "
            "expand with one concrete example next time."
        )

    if memory:
        from app.agent.memory import thin_daf_fields

        thin = thin_daf_fields(memory)
        if thin:
            notes.append(
                f"DAF coverage still thin on: {', '.join(thin)}. "
                "Expect the board to return here."
            )
        threads = memory.get("openThreads") or []
        if threads:
            topics = "; ".join(str(t.get("topic") or "") for t in threads[:3])
            weaknesses.append(f"Unfinished threads left open: {topics}.")
        claims = memory.get("claims") or []
        if len(claims) >= 2:
            strengths.append(
                f"Panel captured {len(claims)} concrete claims from your answers — "
                "good specificity footprint."
            )
        notes.append(
            f"Session pressure level ended at {float(memory.get('pressureLevel') or 0):.2f}."
        )

    if not weaknesses:
        strengths.append("No major length/hedge flags — keep grounding answers in DAF facts.")
    if len(strengths) > 6:
        strengths = strengths[:6]
    if len(weaknesses) > 8:
        weaknesses = weaknesses[:8]

    # Discipline
    kind_counts: dict[str, int] = defaultdict(int)
    for v in violations:
        kind_counts[str(v.get("kind") or "unknown")] += 1
    discipline_notes = [
        f"{k.replace('-', ' ')}: {c} time(s)" for k, c in sorted(kind_counts.items())
    ]
    if not discipline_notes:
        discipline_notes.append("No discipline events logged this session.")

    name = (profile or {}).get("name") or "Candidate"
    return {
        "candidateName": name,
        "questionCount": len(board_qs),
        "answerCount": len(answers),
        "categoryCoverage": coverage,
        "boardReport": {
            "title": "Board Report",
            "summary": (
                f"{len(board_qs)} questions · {len(answers)} answers · "
                f"{sum(1 for b, _ in pairs if b.get('isFollowUp'))} follow-ups"
            ),
            "strengths": strengths or ["Session too short to judge strengths."],
            "weaknesses": weaknesses or ["No automatic weakness flags."],
            "notes": notes
            or [
                "Complete a longer session for denser transcript feedback.",
            ],
        },
        "disciplineReport": {
            "title": "Discipline Report",
            "eventCount": len(violations),
            "notes": discipline_notes,
        },
    }


def _daf_cross_check(
    pairs: list[tuple[dict, dict | None]],
    notes: list[str],
    weaknesses: list[str],
) -> None:
    """Flag when optional/hobby etc. is named early but never connected later."""
    texts = [
        ((bq.get("text") or "") + " " + ((ans or {}).get("text") or "")).lower()
        for bq, ans in pairs
    ]
    if len(texts) < 3:
        return

    # Find Q indices mentioning optional / hobby tokens
    opt_qs = [i for i, t in enumerate(texts, 1) if "optional" in t or "subject" in t]
    hobby_qs = [i for i, t in enumerate(texts, 1) if "hobby" in t or "hobbies" in t]

    if opt_qs and hobby_qs:
        later = [i for i in range(max(opt_qs[-1], hobby_qs[-1]) + 1, len(texts) + 1)]
        # If both topics appeared but no later answer bridges them
        bridged = False
        for i in later:
            t = texts[i - 1]
            if ("optional" in t or "subject" in t) and (
                "hobby" in t or "interest" in t or "passion" in t
            ):
                bridged = True
                break
        if not bridged and len(texts) >= 4:
            weaknesses.append(
                f"Q{opt_qs[0]} / Q{hobby_qs[0]} — optional/subject and hobby "
                "came up separately; you never connected them in a later answer "
                "(boards often test DAF coherence)."
            )

    # Work vs ethics: work mentioned early, ethics later without reference
    work_qs = [i for i, t in enumerate(texts, 1) if "work" in t or "job" in t or "office" in t]
    ethics_qs = [
        i
        for i, t in enumerate(texts, 1)
        if "ethic" in t or "corrupt" in t or "integrity" in t or "bribe" in t
    ]
    if work_qs and ethics_qs and ethics_qs[-1] > work_qs[0]:
        eth = texts[ethics_qs[-1] - 1]
        if "work" not in eth and "job" not in eth and "office" not in eth:
            notes.append(
                f"Q{ethics_qs[-1]} — ethics question after work discussion (Q{work_qs[0]}); "
                "tying the dilemma to your stated experience usually scores better."
            )
