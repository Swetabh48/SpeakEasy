#!/usr/bin/env python3
"""Split filtered SFT JSONL into train/val ShareGPT-style files."""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", type=Path, required=True)
    ap.add_argument("--train", type=Path, default=Path("training/data/train.jsonl"))
    ap.add_argument("--val", type=Path, default=Path("training/data/val.jsonl"))
    ap.add_argument("--val-ratio", type=float, default=0.05)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    rows = [
        json.loads(line)
        for line in args.inp.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    rng = random.Random(args.seed)
    rng.shuffle(rows)
    n_val = max(1, int(len(rows) * args.val_ratio)) if rows else 0
    val, train = rows[:n_val], rows[n_val:]

    for path, data in ((args.train, train), (args.val, val)):
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            for row in data:
                # ShareGPT-ish: conversations from messages
                conv = [
                    {
                        "from": (
                            "system"
                            if m["role"] == "system"
                            else "human"
                            if m["role"] == "user"
                            else "gpt"
                        ),
                        "value": m["content"],
                    }
                    for m in row.get("messages") or []
                ]
                f.write(
                    json.dumps(
                        {"conversations": conv, "meta": row.get("meta") or {}},
                        ensure_ascii=False,
                    )
                    + "\n"
                )
    print(f"train={len(train)} val={len(val)}")


if __name__ == "__main__":
    main()
