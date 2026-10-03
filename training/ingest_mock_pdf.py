#!/usr/bin/env python3
"""
Ingest mock_interview.pdf (user-provided mock-interview transcriptions)
into SFT turns + a compact style pack used by the live board brain.

Usage (repo root):
  python training/ingest_mock_pdf.py
  python training/ingest_mock_pdf.py --pdf mock_interview.pdf
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "mock_interview.pdf"
OUT_DIR = ROOT / "training" / "data"
APP_PACK = ROOT / "src" / "lib" / "boardAgent" / "data" / "board_style_pack.json"

BOARD_START = re.compile(
    r"(?i)\b("
    r"tell me|please give|please be seated|good morning|"
    r"why (should|don't|do|is|are|did|would|can't|can)|"
    r"how (will|do|did|can|would|is|are)|"
    r"what (is|are|do|did|would|about|new)|"
    r"aren't you|isn't it|okay |all right|alright|"
    r"one (last |more )?question|last question|"
    r"would you|can you|do you think|have you|"
    r"coming from|with respect to"
    r")\b"
)
CAND_START = re.compile(
    r"(?i)\b("
    r"so my name|my name is|i was born|i('ve| have) completed|"
    r"so i (feel|think|believe|want|would|am|was)|"
    r"i feel|i think|i believe|sir[, ]|thank you sir|"
    r"currently i|i went on|with respect to"
    r")\b"
)


def extract_pdf_text(pdf: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(pdf))
    chunks: list[str] = []
    for page in reader.pages:
        chunks.append(page.extract_text() or "")
    raw = "\n".join(chunks)
    # Auto-caption PDFs often put one word per line
    text = re.sub(r"\n+", " ", raw)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\[Music\]", " ", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def split_interviews(text: str) -> list[str]:
    # Split near classic board openings
    parts = re.split(
        r"(?i)(?=(?:please be seated|please give a brief introduction about yourself))",
        text,
    )
    interviews: list[str] = []
    for p in parts:
        p = p.strip()
        if len(p) < 400:
            continue
        interviews.append(p)
    if len(interviews) < 2:
        # Fallback: chunk by length
        step = max(4000, len(text) // 10)
        interviews = [text[i : i + step] for i in range(0, len(text), step) if text[i : i + step].strip()]
    return interviews[:12]


def _sentences(block: str) -> list[str]:
    # Keep ? . ! as boundaries; also "okay " often starts board turns
    rough = re.split(r"(?<=[.?!])\s+|\s+(?=okay\s)|(?<=sir)\s+(?=[A-Z])", block)
    out: list[str] = []
    for s in rough:
        s = s.strip(" -\t")
        if len(s) < 12:
            continue
        out.append(s)
    return out


def segment_turns(interview: str) -> list[dict]:
    """Heuristic board/candidate segmentation for caption-style transcripts."""
    sents = _sentences(interview)
    turns: list[dict] = []
    buf_role: str | None = None
    buf: list[str] = []

    def flush() -> None:
        nonlocal buf_role, buf
        if not buf_role or not buf:
            buf_role, buf = None, []
            return
        text = " ".join(buf).strip()
        text = re.sub(r"\s+", " ", text)
        if len(text.split()) >= 4:
            turns.append({"role": buf_role, "text": text})
        buf_role, buf = None, []

    for s in sents:
        is_q = s.endswith("?") or bool(BOARD_START.search(s[:80]))
        is_a = bool(CAND_START.search(s[:100])) and not s.endswith("?")
        role = None
        if is_q and not is_a:
            role = "board"
        elif is_a:
            role = "candidate"
        elif buf_role:
            role = buf_role
        else:
            # default: short interrogative-ish → board, else candidate
            role = "board" if ("?" in s or len(s.split()) < 18) else "candidate"

        if buf_role and role != buf_role:
            flush()
        buf_role = role
        buf.append(s)
        # Keep board questions short
        if buf_role == "board" and (s.endswith("?") or len(" ".join(buf).split()) > 45):
            flush()
        if buf_role == "candidate" and len(" ".join(buf).split()) > 160:
            flush()
    flush()

    # Merge adjacent same-role
    merged: list[dict] = []
    for t in turns:
        if merged and merged[-1]["role"] == t["role"]:
            merged[-1]["text"] = (merged[-1]["text"] + " " + t["text"]).strip()
        else:
            merged.append(t)
    return merged


PERSONAS = [
    ("chair", "Dr. Mehta", "chair-daf"),
    ("member-a", "Ms. Iyer", "subject"),
    ("member-b", "Prof. Khan", "affairs-ethics"),
    ("member-c", "Mr. Rao", "quiet"),
    ("member-d", "Dr. Sen", "skeptic"),
]


def to_sft(turns: list[dict], interview_id: int) -> list[dict]:
    history: list[dict] = []
    out: list[dict] = []
    board_i = 0
    for t in turns:
        if t["role"] == "board":
            pid, pname, domain = PERSONAS[board_i % len(PERSONAS)]
            if board_i == 0:
                pid, pname, domain = PERSONAS[0]
            board_i += 1
            last = next(
                (h["text"] for h in reversed(history) if h["role"] == "candidate"),
                None,
            )
            move = "press" if last and board_i > 1 else "new_topic"
            if last and len(last.split()) < 25:
                move = "invite_example"
            system = (
                f"You are {pname} on an Indian government interview board. "
                f"Domain: {domain}. Speak 1-3 clear conversational sentences. "
                "When pressing, quote or paraphrase the candidate."
            )
            user = (
                f"MOVE={move}\nLAST_ANSWER={last or '(none)'}\n"
                f"RECENT={json.dumps(history[-6:], ensure_ascii=False)}"
            )
            out.append(
                {
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                        {"role": "assistant", "content": t["text"][:600]},
                    ],
                    "meta": {
                        "source": "mock_interview_pdf",
                        "interviewId": interview_id,
                        "persona": pid,
                        "move": move,
                    },
                }
            )
            history.append({"role": "board", "text": t["text"][:600], "speakerId": pid})
        else:
            history.append({"role": "candidate", "text": t["text"][:800]})
    return out


def build_style_pack(all_turns: list[list[dict]], max_pairs: int = 80) -> dict:
    pairs: list[dict] = []
    for turns in all_turns:
        for i, t in enumerate(turns):
            if t["role"] != "board":
                continue
            prev = turns[i - 1]["text"] if i > 0 and turns[i - 1]["role"] == "candidate" else ""
            nxt = turns[i + 1]["text"] if i + 1 < len(turns) and turns[i + 1]["role"] == "candidate" else ""
            q = t["text"].strip()
            if len(q.split()) < 5 or len(q.split()) > 60:
                continue
            pairs.append(
                {
                    "board": q[:420],
                    "priorAnswer": prev[:320] if prev else "",
                    "candidateReply": nxt[:420] if nxt else "",
                    "tags": _tags(q + " " + prev),
                }
            )
    # Prefer pairs that have both sides
    pairs.sort(key=lambda p: (1 if p["priorAnswer"] else 0) + (1 if p["candidateReply"] else 0), reverse=True)
    # Dedupe by board prefix
    seen: set[str] = set()
    uniq: list[dict] = []
    for p in pairs:
        key = p["board"][:60].lower()
        if key in seen:
            continue
        seen.add(key)
        uniq.append(p)
        if len(uniq) >= max_pairs:
            break
    return {
        "version": 1,
        "source": "mock_interview.pdf",
        "pairCount": len(uniq),
        "pairs": uniq,
    }


def _tags(text: str) -> list[str]:
    t = text.lower()
    tags = []
    for key in (
        "bureaucracy",
        "policy",
        "media",
        "privilege",
        "training",
        "introduction",
        "ethics",
        "panchayat",
        "village",
        "technology",
        "ai",
        "crisis",
        "optional",
        "hobby",
        "district",
        "corruption",
        "constitution",
    ):
        if key in t:
            tags.append(key)
    return tags[:8]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    ap.add_argument("--max-pairs", type=int, default=80)
    args = ap.parse_args()
    if not args.pdf.exists():
        raise SystemExit(f"PDF not found: {args.pdf}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    text = extract_pdf_text(args.pdf)
    (OUT_DIR / "mock_pdf_clean.txt").write_text(text, encoding="utf-8")

    interviews = split_interviews(text)
    all_turns: list[list[dict]] = []
    sft: list[dict] = []
    for i, iv in enumerate(interviews):
        turns = segment_turns(iv)
        # Keep interviews with enough board turns
        board_n = sum(1 for t in turns if t["role"] == "board")
        if board_n < 3:
            continue
        all_turns.append(turns)
        sft.extend(to_sft(turns, i))
        (OUT_DIR / f"interview_{i:02d}_turns.json").write_text(
            json.dumps(turns, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    sft_path = OUT_DIR / "sft_from_mock_pdf.jsonl"
    with sft_path.open("w", encoding="utf-8") as f:
        for row in sft:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    pack = build_style_pack(all_turns, max_pairs=args.max_pairs)
    pack_path = OUT_DIR / "board_style_pack.json"
    pack_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
    APP_PACK.parent.mkdir(parents=True, exist_ok=True)
    APP_PACK.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"interviews_kept={len(all_turns)}")
    print(f"sft_turns={len(sft)} -> {sft_path}")
    print(f"style_pairs={pack['pairCount']} -> {pack_path}")
    print(f"app_pack -> {APP_PACK}")


if __name__ == "__main__":
    main()
