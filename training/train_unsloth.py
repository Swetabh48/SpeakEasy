#!/usr/bin/env python3
"""
QLoRA fine-tune with Unsloth → save adapters → optional GGUF export.

Requires a CUDA GPU machine. Install (example):
  pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
  pip install torch transformers datasets trl

Usage:
  python training/train_unsloth.py --train training/data/train.jsonl --out training/out/speakeasy-board-lora

Then convert / create Ollama model — see training/README.md.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def load_rows(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        obj = json.loads(line)
        if "messages" in obj:
            rows.append(obj)
        elif "conversations" in obj:
            role_map = {"system": "system", "human": "user", "gpt": "assistant"}
            msgs = [
                {"role": role_map.get(c["from"], "user"), "content": c["value"]}
                for c in obj["conversations"]
            ]
            rows.append({"messages": msgs})
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=Path("training/out/speakeasy-board-lora"))
    ap.add_argument("--base", default="unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit")
    ap.add_argument("--steps", type=int, default=200)
    ap.add_argument("--lr", type=float, default=2e-4)
    args = ap.parse_args()

    try:
        from unsloth import FastLanguageModel  # type: ignore
        from datasets import Dataset  # type: ignore
        from trl import SFTTrainer  # type: ignore
        from transformers import TrainingArguments  # type: ignore
    except ImportError:
        print(
            "Unsloth/TRL not installed. On a GPU machine:\n"
            '  pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"\n'
            "  pip install datasets trl transformers\n"
            "Then re-run this script.",
            file=sys.stderr,
        )
        sys.exit(2)

    rows = load_rows(args.train)
    if len(rows) < 20:
        print(f"Need more training rows (got {len(rows)}). Run synthesize + filter first.")
        sys.exit(1)

    max_seq = 2048
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base,
        max_seq_length=max_seq,
        load_in_4bit=True,
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
    )

    def formatting(example: dict) -> str:
        return tokenizer.apply_chat_template(
            example["messages"],
            tokenize=False,
            add_generation_prompt=False,
        )

    ds = Dataset.from_list(rows)
    args.out.mkdir(parents=True, exist_ok=True)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=ds,
        formatting_func=formatting,
        max_seq_length=max_seq,
        args=TrainingArguments(
            output_dir=str(args.out),
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            max_steps=args.steps,
            learning_rate=args.lr,
            logging_steps=10,
            save_steps=args.steps,
            fp16=True,
            optim="adamw_8bit",
            report_to=[],
        ),
    )
    trainer.train()
    model.save_pretrained(str(args.out))
    tokenizer.save_pretrained(str(args.out))
    print(f"Saved LoRA adapters → {args.out}")
    print("Next: export GGUF / ollama create — see training/README.md")


if __name__ == "__main__":
    main()
