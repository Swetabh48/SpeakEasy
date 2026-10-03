# Training data sources (rights-cleared only)

SpeakEasy board fine-tuning uses **only** materials you have rights to use.

## Sources used

1. **`mock_interview.pdf`** (repo root) — mock-interview transcriptions placed by the project owner for Speakeasy educational board practice. Ingested via `ingest_mock_pdf.py` into SFT + compact `board_style_pack.json` (shipped with the app).
2. **Synthetic multi-turn board dialogues** from `synthesize_dialogues.py` (DAF seeds + persona cards).
3. Optional: additional materials under `training/data/external/` listed below.

## External sources ledger

| Path | Title / description | Notes | Added by |
|------|---------------------|-------|----------|
| `mock_interview.pdf` | Mock UPSC-style interview transcriptions (10 sessions packed) | Owner-supplied for Speakeasy education / training | project owner |
