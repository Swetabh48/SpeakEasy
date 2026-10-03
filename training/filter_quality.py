#!/usr/bin/env python3
"""Drop weak SFT turns: cryptic, off-persona, or non-referential follow-ups."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

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
    "i",
    "we",
    "you",
    "my",
    "that",
    "this",
    "with",
}


def tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-zA-Z]{4,}", text.lower()) if w not in STOP}


def keep(row: dict) -> bool:
    msgs = row.get("messages") or []
    if len(msgs) < 3:
        return False
    assistant = (msgs[-1].get("content") or "").strip()
    user = msgs[-2].get("content") or ""
    if not assistant or len(assistant.split()) < 6:
        return False
    if len(assistant.split()) > 90:
        return False
    # cryptic one-liners / all-caps slogans
    if assistant.isupper() and len(assistant.split()) < 12:
        return False
    if re.search(r"^\s*(question|q)\s*:", assistant, re.I):
        return False
    meta = row.get("meta") or {}
    move = meta.get("move") or ""
    if move in ("press", "clarify", "invite_example"):
        m = re.search(r"LAST_ANSWER=(.*?)(?:\nRECENT=|\Z)", user, re.S)
        last = (m.group(1) if m else "").strip()
        if last and last != "(none)":
            if len(tokens(assistant) & tokens(last)) < 1 and '"' not in assistant:
                return False
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    kept = 0
    total = 0
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.inp.open(encoding="utf-8") as fin, args.out.open("w", encoding="utf-8") as fout:
        for line in fin:
            line = line.strip()
            if not line:
                continue
            total += 1
            row = json.loads(line)
            if keep(row):
                fout.write(json.dumps(row, ensure_ascii=False) + "\n")
                kept += 1
    print(f"Kept {kept}/{total} -> {args.out}")


if __name__ == "__main__":
    main()
