# SpeakEasy engineering & product roadmap

This file is the **speak_readme** entry point. Full plan:

→ **[SpeakEasy_ROADMAP.md](./SpeakEasy_ROADMAP.md)**

## Live / any-PC (current)

Board interview runs on **Vercel via Next.js `/api/board/*`** so it works for everyone without a laptop FastAPI.

Do **not** set `NEXT_PUBLIC_BACKEND_URL` on Vercel (or the browser will try `localhost:8000` and fail).

Optional cloud LLM for richer board questions: `EVALUATOR_URL` + `EVALUATOR_API_KEY` on Vercel.

Optional local FastAPI + Ollama: see `backend/README.md` and set `NEXT_PUBLIC_BACKEND_URL` only on your machine.

## Env pointer

`.env.example` / `.env.local` include:

```bash
SPEAK_README=SpeakEasy_ROADMAP.md
```
