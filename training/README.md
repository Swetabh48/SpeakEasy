# Speakeasy board LoRA training

Uses your `mock_interview.pdf` (mock-board transcriptions you placed in the repo) **plus** synthetic dialogues → filter → Colab/Unsloth QLoRA → Hugging Face (free for all visitors) or Ollama.

See [SOURCES.md](./SOURCES.md).

## 1) Ingest your mock interviews (required)

```powershell
# PDF at repo root: mock_interview.pdf
python training/ingest_mock_pdf.py
# → training/data/sft_from_mock_pdf.jsonl
# → src/lib/boardAgent/data/board_style_pack.json  (ships with the app for EVERY PC)
```

The style pack is the live “brain DNA”: even without an API key, panel questions come from these mock interviews (not empty hardcode).

## 2) Full dataset for fine-tune

```powershell
python training/prepare_full_dataset.py --synthetic-dialogues 80
# → training/data/train.jsonl + val.jsonl
```

## 3) Train + host on Modal (already wired)

This repo trains LoRA on Modal and serves OpenAI-compatible chat for every visitor:

```powershell
modal volume put --force speakeasy-board-data training/data/train.jsonl /train.jsonl
modal run --detach training/modal_board_brain.py --steps 80
modal deploy training/modal_board_brain.py
```

Live endpoint (example):
`https://swetabh48--speakeasy-board-brain-serve.modal.run`

Set on **Vercel** (and `.env.local`):
```
EVALUATOR_URL=https://swetabh48--speakeasy-board-brain-serve.modal.run
EVALUATOR_MODEL=speakeasy-board
```

Note: Modal **GPU** needs a payment method; this pipeline uses Modal **CPU** + SmolLM2-360M LoRA (free). Add a card later for T4/A10 + Llama-8B if you want a bigger brain.

Optional Colab/HF path remains in `Speakeasy_Board_LoRA_Colab.ipynb`.

## Legacy / local-only pipeline

```powershell
python training/synthesize_dialogues.py --dialogues 80 --out training/data/raw_dialogues.jsonl
python training/filter_quality.py --in training/data/sft_turns.jsonl --out training/data/sft_filtered.jsonl
python training/export_sharegpt.py --in training/data/sft_filtered.jsonl
```

### GPU fine-tune (Unsloth QLoRA)

On a machine with NVIDIA CUDA:

```powershell
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
pip install datasets trl transformers
python training/train_unsloth.py --train training/data/train.jsonl --out training/out/speakeasy-board-lora
```

### Export GGUF + Ollama

Options:

1. **Unsloth** `save_pretrained_gguf` (if your Unsloth version supports it) into `training/out/speakeasy-board.Q4_K_M.gguf`
2. Or merge adapters + convert with [llama.cpp](https://github.com/ggerganov/llama.cpp) `convert_hf_to_gguf.py` + quantize `Q4_K_M`

Then:

```powershell
cd training
# Edit Modelfile FROM path if your GGUF name differs
ollama create speakeasy-board -f Modelfile
ollama run speakeasy-board "You are Dr. Mehta. Ask a warm welcome question for Ananya from Rajasthan."
```

App / backend env:

```
OLLAMA_MODEL=speakeasy-board
```

Or host the same model behind any OpenAI-compatible gateway and set `EVALUATOR_URL` / `EVALUATOR_API_KEY` (free Groq works for inference without fine-tune).

## Target size

First LoRA: **~2k–5k** assistant turns (80–200 synthetic dialogues × ~8 board turns). Style + follow-up habit on Llama 3.1 8B Instruct.
