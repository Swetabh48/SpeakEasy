# SpeakEasy Board API

FastAPI + Postgres backend for DAF-driven board interviews, agentic question generation, and eval harness.

## Quick start

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Defaults to **SQLite** (`speakeasy_board.db`) so you can run without Docker.

Optional Postgres:

```bash
# Start Docker Desktop first, then:
docker compose up -d db
# set DATABASE_URL=postgresql+psycopg://speakeasy:speakeasy@127.0.0.1:5432/speakeasy
```

Or full stack via Docker (API + Postgres):

```bash
docker compose up --build
```

Health: `GET http://127.0.0.1:8000/health`

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/board/session` | Create profile + session from DAF JSON |
| POST | `/board/question` | Agent loop → next board question + tool trace |
| POST | `/board/answer` | Store candidate transcript + optional violations |
| POST | `/eval/run` | Run eval harness against seeded cases |
| GET | `/eval/results` | Recent eval run averages |

## Agent loop

1. **Planner** (Ollama) — needs current-affairs tool?
2. **Tool** — `current_affairs_lookup` via PIB / Hindu / Indian Express RSS
3. **Generator** (Ollama) — one DAF-conditioned question
4. Trace written to `tool_call_logs`

If Ollama is down, deterministic fallback questions still work.

## Frontend

Set in Next.js `.env.local`:

```
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

Open `/board` in the Speakeasy app.
