#!/usr/bin/env python3
"""
Generate rights-cleared synthetic board dialogues for LoRA SFT.

Uses template + optional teacher LLM (EVALUATOR_* or Ollama). Never scrapes YouTube.

Usage (from repo root):
  python training/synthesize_dialogues.py --dialogues 40 --out training/data/raw_dialogues.jsonl
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SEEDS = ROOT / "seeds" / "profiles.json"

PERSONAS = [
    {
        "id": "chair",
        "name": "Dr. Mehta",
        "domain": "chair-daf",
        "blurb": "Calm chair; DAF / hometown / hobby.",
    },
    {
        "id": "member-a",
        "name": "Ms. Iyer",
        "domain": "subject",
        "blurb": "Optional / technical member.",
    },
    {
        "id": "member-b",
        "name": "Prof. Khan",
        "domain": "affairs-ethics",
        "blurb": "Ethics and affairs as short stories.",
    },
    {
        "id": "member-c",
        "name": "Mr. Rao",
        "domain": "quiet",
        "blurb": "Quiet personal questions.",
    },
    {
        "id": "member-d",
        "name": "Dr. Sen",
        "domain": "skeptic",
        "blurb": "Witty skeptic; presses contradictions.",
    },
]


def _pick(seed: str, items: list[str]) -> str:
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    return items[h % len(items)]


def _teacher_chat(system: str, user: str) -> str:
    url = os.environ.get("EVALUATOR_URL", "").strip()
    model = os.environ.get("EVALUATOR_MODEL", "llama-3.1-8b-instant").strip()
    key = os.environ.get("EVALUATOR_API_KEY", "").strip()
    if url:
        payload = json.dumps(
            {
                "model": model,
                "temperature": 0.7,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            }
        ).encode()
        req = urllib.request.Request(
            f"{url.rstrip('/')}/v1/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {key}"} if key else {}),
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as res:
                data = json.loads(res.read().decode())
            return (
                ((data.get("choices") or [{}])[0].get("message") or {}).get("content")
                or ""
            ).strip()
        except Exception:
            return ""
    ollama = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").strip()
    omodel = os.environ.get("OLLAMA_MODEL", "llama3.1:latest").strip()
    payload = json.dumps(
        {
            "model": omodel,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
    ).encode()
    req = urllib.request.Request(
        f"{ollama.rstrip('/')}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            data = json.loads(res.read().decode())
        return ((data.get("message") or {}).get("content") or "").strip()
    except Exception:
        return ""


def _template_turn(
    persona: dict,
    profile: dict,
    move: str,
    last_answer: str | None,
    turn_i: int,
) -> str:
    name = profile.get("name") or "Candidate"
    state = profile.get("homeState") or "your state"
    optional = profile.get("optionalSubject") or profile.get("engineeringBranch") or "your subject"
    if turn_i == 0:
        return (
            f"Good morning, {name}. Please introduce yourself briefly — "
            f"education, hometown in {state}, and why you are here."
        )
    if move in ("press", "clarify", "invite_example") and last_answer:
        snip = " ".join(last_answer.split()[:16])
        if persona["id"] == "member-d":
            return (
                f"Alright {name}, you said roughly \"{snip}\". "
                f"A popular officer might do the opposite — why are they wrong?"
            )
        return (
            f"Thank you. Stay with that. When you say \"{snip}\", "
            f"what is the first practical step, and who is helped or hurt?"
        )
    if persona["id"] == "member-a":
        return (
            f"About {optional}: give one field situation where book knowledge "
            f"stops a popular but wrong order."
        )
    if persona["id"] == "member-b":
        return (
            f"Picture tension in a district of {state}. Your SDM freezes. "
            f"What are your first three orders?"
        )
    if persona["id"] == "member-c":
        return (
            f"Softly asked, {name}: what opinion on your DAF might this board "
            f"dislike — and would you still defend it?"
        )
    return (
        f"You mentioned {state}. Growing up there — one concrete memory that "
        f"shaped how you think about administration?"
    )


def _stub_answer(profile: dict, move: str, vague: bool) -> str:
    state = profile.get("homeState") or "my state"
    optional = profile.get("optionalSubject") or profile.get("engineeringBranch") or "my subject"
    if vague:
        return "I think maybe various things overall, going forward, synergy."
    return (
        f"In {state}, with my background in {optional}, I would apply the rule first, "
        f"document the decision, brief my collector, and accept the trade-off on speed."
    )


def build_dialogue(profile: dict, rng: random.Random, use_teacher: bool) -> dict:
    turns = []
    last_answer = None
    speaker_ids = []
    for i in range(rng.randint(6, 10)):
        if i == 0:
            persona = PERSONAS[0]
            move = "new_topic"
        elif last_answer and ("maybe" in last_answer or "various" in last_answer):
            idx = 4 if rng.random() < 0.35 else (speaker_ids[-1] if speaker_ids else 0)
            persona = PERSONAS[idx]
            move = rng.choice(["press", "clarify", "invite_example"])
        else:
            persona = rng.choice(PERSONAS[1:] if i > 2 else PERSONAS[:2])
            move = "new_topic"

        if use_teacher:
            system = (
                f"You are {persona['name']} ({persona['blurb']}). "
                "Speak 1-3 plain board sentences. No markdown."
            )
            user = (
                f"MOVE={move}\nPROFILE={json.dumps(profile)}\n"
                f"LAST_ANSWER={last_answer or '(none)'}\n"
                "Produce the next spoken board turn."
            )
            text = _teacher_chat(system, user)
            if not text:
                text = _template_turn(persona, profile, move, last_answer, i)
        else:
            text = _template_turn(persona, profile, move, last_answer, i)

        text = text.split("\n")[0].strip().strip('"')
        turns.append(
            {
                "role": "board",
                "speakerId": persona["id"],
                "speakerName": persona["name"],
                "move": move,
                "text": text,
            }
        )
        speaker_ids.append(PERSONAS.index(persona) if persona in PERSONAS else 0)

        vague = rng.random() < 0.35
        ans = _stub_answer(profile, move, vague)
        if use_teacher and not vague:
            ans_llm = _teacher_chat(
                "You are a sincere civil services candidate. Answer in 2-5 sentences.",
                f"Question: {text}\nProfile: {json.dumps(profile)}",
            )
            if ans_llm:
                ans = ans_llm.split("\n")[0].strip()
        turns.append({"role": "candidate", "text": ans})
        last_answer = ans

    return {"profile": profile, "turns": turns}


def to_sft_examples(dialogue: dict) -> list[dict]:
    profile = dialogue["profile"]
    history: list[dict] = []
    out: list[dict] = []
    for t in dialogue["turns"]:
        if t["role"] == "board":
            persona = next(p for p in PERSONAS if p["id"] == t["speakerId"])
            last_ans = next(
                (h["text"] for h in reversed(history) if h.get("role") == "candidate"),
                None,
            )
            system = (
                f"You are {persona['name']} on an Indian government interview board. "
                f"Domain: {persona['domain']}. {persona['blurb']} "
                "One clear spoken turn, 1-3 sentences."
            )
            user = (
                f"MOVE={t.get('move')}\nPROFILE={json.dumps(profile)}\n"
                f"LAST_ANSWER={last_ans or '(none)'}\n"
                f"RECENT={json.dumps(history[-6:])}"
            )
            out.append(
                {
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                        {"role": "assistant", "content": t["text"]},
                    ],
                    "meta": {
                        "track": profile.get("track"),
                        "persona": persona["id"],
                        "move": t.get("move"),
                    },
                }
            )
        history.append(t)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dialogues", type=int, default=40)
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "raw_dialogues.jsonl")
    ap.add_argument("--sft-out", type=Path, default=ROOT / "data" / "sft_turns.jsonl")
    ap.add_argument("--teacher", action="store_true", help="Call EVALUATOR_/Ollama teacher")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    profiles = json.loads(SEEDS.read_text(encoding="utf-8"))
    rng = random.Random(args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)

    all_sft: list[dict] = []
    with args.out.open("w", encoding="utf-8") as f:
        for i in range(args.dialogues):
            profile = profiles[i % len(profiles)]
            # slight name jitter so dialogues differ
            p = dict(profile)
            p["name"] = f"{profile['name'].split()[0]} {chr(65 + (i % 26))}{i}"
            dlg = build_dialogue(p, rng, use_teacher=args.teacher)
            f.write(json.dumps(dlg, ensure_ascii=False) + "\n")
            all_sft.extend(to_sft_examples(dlg))

    with args.sft_out.open("w", encoding="utf-8") as f:
        for row in all_sft:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Wrote {args.dialogues} dialogues -> {args.out}")
    print(f"Wrote {len(all_sft)} SFT turns -> {args.sft_out}")


if __name__ == "__main__":
    main()
