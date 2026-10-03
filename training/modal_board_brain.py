"""
Train Speakeasy board LoRA on Modal (CPU-friendly small model — no GPU card required)
and serve OpenAI-compatible /v1/chat/completions for every visitor.

  modal volume put --force speakeasy-board-data training/data/train.jsonl /train.jsonl
  modal run --detach training/modal_board_brain.py --steps 300
  modal deploy training/modal_board_brain.py
"""

from __future__ import annotations

import json
import modal

APP_NAME = "speakeasy-board-brain"
VOL_NAME = "speakeasy-board-data"
MODEL_DIR = "/vol/speakeasy-board-lora"
TRAIN_PATH = "/vol/train.jsonl"
# Stronger small instruct model — still trains on Modal free CPU
BASE_MODEL = "Qwen/Qwen2.5-1.5B-Instruct"

app = modal.App(APP_NAME)
vol = modal.Volume.from_name(VOL_NAME, create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.5.1",
        "transformers==4.49.0",
        "datasets==3.3.2",
        "trl==0.15.2",
        "accelerate==1.4.0",
        "peft==0.14.0",
        "sentencepiece",
        "protobuf",
        "huggingface_hub",
        "fastapi",
        "uvicorn",
    )
)


def _load_rows(path: str) -> list[dict]:
    rows: list[dict] = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            obj = json.loads(line)
            if "messages" in obj:
                rows.append({"messages": obj["messages"]})
            elif "conversations" in obj:
                role = {"system": "system", "human": "user", "gpt": "assistant"}
                rows.append(
                    {
                        "messages": [
                            {
                                "role": role.get(c["from"], "user"),
                                "content": c["value"],
                            }
                            for c in obj["conversations"]
                        ]
                    }
                )
    return rows


@app.function(
    image=image,
    # Free Modal path: no payment method required for CPU
    cpu=8.0,
    memory=16384,
    timeout=60 * 60 * 3,
    volumes={"/vol": vol},
)
def train(max_steps: int = 300):
    import os

    from datasets import Dataset
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from trl import SFTConfig, SFTTrainer

    vol.reload()
    rows = _load_rows(TRAIN_PATH)
    if len(rows) < 20:
        raise RuntimeError(f"Need {TRAIN_PATH} on volume, got {len(rows)} rows")
    print(f"Loaded {len(rows)} SFT rows; base={BASE_MODEL}")

    tok = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, trust_remote_code=True)
    model = get_peft_model(
        model,
        LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            target_modules=[
                "q_proj",
                "k_proj",
                "v_proj",
                "o_proj",
                "gate_proj",
                "up_proj",
                "down_proj",
            ],
        ),
    )

    def formatting(example):
        return {
            "text": tok.apply_chat_template(
                example["messages"],
                tokenize=False,
                add_generation_prompt=False,
            )
        }

    ds = Dataset.from_list(rows).map(formatting)
    trainer = SFTTrainer(
        model=model,
        processing_class=tok,
        train_dataset=ds,
        args=SFTConfig(
            output_dir="/tmp/board-lora",
            dataset_text_field="text",
            max_seq_length=1024,
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            max_steps=max_steps,
            learning_rate=2e-4,
            logging_steps=20,
            fp16=False,
            bf16=False,
            optim="adamw_torch",
            report_to=[],
            save_steps=max_steps,
            warmup_steps=20,
        ),
    )
    trainer.train()
    os.makedirs(MODEL_DIR, exist_ok=True)
    model.save_pretrained(MODEL_DIR)
    tok.save_pretrained(MODEL_DIR)
    with open(os.path.join(MODEL_DIR, "base_model.txt"), "w", encoding="utf-8") as f:
        f.write(BASE_MODEL)
    vol.commit()
    print(f"Saved LoRA -> {MODEL_DIR}")
    return {"rows": len(rows), "steps": max_steps, "base": BASE_MODEL, "path": MODEL_DIR}


@app.function(
    image=image,
    cpu=4.0,
    memory=8192,
    timeout=60 * 10,
    volumes={"/vol": vol},
    scaledown_window=300,
)
@modal.asgi_app()
def serve():
    """OpenAI-compatible board brain — point Vercel EVALUATOR_URL here."""
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer
    import torch
    import os

    api = FastAPI(title="Speakeasy Board Brain")
    state: dict = {"ready": False}

    def ensure():
        if state.get("ready"):
            return
        vol.reload()
        base = BASE_MODEL
        base_file = os.path.join(MODEL_DIR, "base_model.txt")
        if os.path.exists(base_file):
            base = open(base_file, encoding="utf-8").read().strip() or base
        tok = AutoTokenizer.from_pretrained(MODEL_DIR, trust_remote_code=True)
        if tok.pad_token is None:
            tok.pad_token = tok.eos_token
        model = AutoModelForCausalLM.from_pretrained(base, trust_remote_code=True)
        model = PeftModel.from_pretrained(model, MODEL_DIR)
        model.eval()
        state["tok"] = tok
        state["model"] = model
        state["ready"] = True

    @api.get("/health")
    def health():
        return {"status": "ok", "model": "speakeasy-board", "ready": state.get("ready", False)}

    @api.post("/v1/chat/completions")
    async def chat(body: dict):
        try:
            ensure()
        except Exception as e:
            return JSONResponse(
                {"error": f"model not ready — wait for training: {e}"},
                status_code=503,
            )
        messages = body.get("messages") or []
        temperature = float(body.get("temperature") or 0.55)
        tok = state["tok"]
        model = state["model"]
        prompt = tok.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        inputs = tok(prompt, return_tensors="pt")
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=120,
                temperature=max(0.3, min(0.9, temperature)),
                do_sample=True,
                top_p=0.9,
                repetition_penalty=1.15,
                pad_token_id=tok.eos_token_id,
            )
        gen = out[0][inputs["input_ids"].shape[-1] :]
        text = tok.decode(gen, skip_special_tokens=True).strip()
        # Keep board turns to first spoken line
        text = text.split("\n")[0].strip().strip('"')
        return {
            "id": "speakeasy-board",
            "object": "chat.completion",
            "model": "speakeasy-board",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": text},
                    "finish_reason": "stop",
                }
            ],
        }

    return api


@app.local_entrypoint()
def main(steps: int = 300):
    print(train.remote(max_steps=steps))
