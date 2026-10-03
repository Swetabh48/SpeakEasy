#!/usr/bin/env python3
"""Merge mock-PDF SFT + synthetic SFT → filtered train/val for LoRA / Colab."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic-dialogues", type=int, default=60)
    args = ap.parse_args()

    # Ensure mock ingest exists
    mock = DATA / "sft_from_mock_pdf.jsonl"
    if not mock.exists():
        raise SystemExit("Run training/ingest_mock_pdf.py first")

    # Refresh synthetic (no teacher — offline)
    import subprocess
    import sys

    subprocess.check_call(
        [
            sys.executable,
            str(ROOT / "synthesize_dialogues.py"),
            "--dialogues",
            str(args.synthetic_dialogues),
            "--out",
            str(DATA / "raw_dialogues.jsonl"),
            "--sft-out",
            str(DATA / "sft_turns.jsonl"),
        ]
    )

    rows = load_jsonl(mock) + load_jsonl(DATA / "sft_turns.jsonl")
    merged = DATA / "sft_merged.jsonl"
    with merged.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    subprocess.check_call(
        [
            sys.executable,
            str(ROOT / "filter_quality.py"),
            "--in",
            str(merged),
            "--out",
            str(DATA / "sft_filtered.jsonl"),
        ]
    )
    subprocess.check_call(
        [
            sys.executable,
            str(ROOT / "export_sharegpt.py"),
            "--in",
            str(DATA / "sft_filtered.jsonl"),
            "--train",
            str(DATA / "train.jsonl"),
            "--val",
            str(DATA / "val.jsonl"),
        ]
    )
    print(f"merged_rows={len(rows)}")
    print("Ready: training/data/train.jsonl + val.jsonl (+ board_style_pack in app)")


if __name__ == "__main__":
    main()
