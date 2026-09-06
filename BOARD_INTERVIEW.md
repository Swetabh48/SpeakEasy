# Board Interview — Session Notes (25 Aug 2026)

What was built and polished today for Speakeasy’s **government exam board interview** mode (UPSC CSE / IES–ESE / IFS personality test + PSU technical viva), with a FastAPI agent backend and a fullscreen panel room on the Next.js app.

---

## Goal
        
Simulate a real Indian board room: DAF-driven questions, a five-member panel that speaks aloud, client-side proctoring, and an agent loop (planner → optional current-affairs tool → question generator) that can be evaluated offline.

---

## What shipped today

### 1. Backend (`/backend`)

| Piece | Role |
|---|---|
| FastAPI app | `POST /board/session`, `/board/question`, `/board/answer`; `/eval/run`, `/eval/results`; `GET /health` |
| Persistence | SQLAlchemy models; **SQLite by default** (`speakeasy_board.db`); optional Postgres via Docker |
| Agent loop | Planner → RSS current-affairs tool (PIB / Hindu / IE) → generator; traces in `tool_call_logs` |
| Ollama | Optional; if down, deterministic fallback questions still work |
| Eval harness | Seeded cases under `backend/app/eval/cases/` + runner |

**Prompt version:** `board-v4` — distinct panelist personas, cross-question follow-ups (~40–50% of answers), fixed skeptic, category tags on turns, structured Board/Discipline debrief. Current-affairs tools still skip the opening turns.

### Realism (v4)

| Feature | Behavior |
|---|---|
| Personas | Chair (DAF), subject member, affairs/ethics generalist, quiet jumper, **skeptic** — routed by topic domain |
| Cross-questioning | After each answer, `should_follow_up` may press on the same topic (hedges, short/vague, DAF echoes) |
| Skeptic | Dr. Sen consistently counter-argues (“are you sure — what about X?”) |
| Pacing cues | Long pause before Answer → “Take your time.”; ~75s ramble → soft wrap-up |
| Debrief | End session → Board Report (transcript-specific notes) + Discipline Report |

### Not yet (planned)

| Item | Notes |
|---|---|
| Piper TTS | Free local neural TTS on backend; Web Speech remains fallback |
| Longitudinal weak-spot trends | Categories are stored on turns; cross-session charts next |
| Nightly full-length eval | `POST /eval/run` with `"fullLength": true` (20 Q/case) is ready |

### 2. Frontend (`/board`)

| Piece | Role |
|---|---|
| `DAFIntakeForm` | Service track + full DAF; required fields starred |
| Dropdowns | Degree, institution, optional subject, engineering branch — each with **Other** + free text |
| Optional PDF | Upload UPSC / application PDF (`pdfjs-dist`); not compulsory; text assists the board |
| Local save | DAF stored in `localStorage` so you do not retype every visit |
| `BoardInterview` | Session orchestration, answer capture, repeat handling |
| `BoardPanelRoom` | Five figurines; rotating speakers |
| TTS | Web Speech API; prefers **en-IN** voices when installed; slower, less robotic rates |
| Proctoring | Camera face checks + tab / fullscreen discipline; spoken warnings |

Nav entry: **Board** on the home shell → `/board`.

### 3. UX fixes from live testing

| Issue | Fix |
|---|---|
| “Repeat the question” advanced to a new Q | `isRepeatRequest()` — board **replays the same question** |
| Straight into aggressive Q1 | Warm welcome + intro first; pressure from ~Q4 |
| “API online” chip always visible | Chip only when backend is **offline** |
| DAF lost on refresh | Save/load via `dafStorage.ts` |
| Free-text degree / college / optional | Dropdown lists + **Other** |
| Wanted DAF PDF upload | Optional upload section on intake |
| Robotic voices | Slower rates + Indian English voice preference |

**Honest limit:** real UPSC panelists’ voices cannot be cloned or trained without consent and licensed data. Speakeasy uses browser TTS and prefers system Indian English voices.

---

## How to run (local)

### Default (same as production — any PC)

```bash
npm install
npm run dev
```

Open [http://localhost:3000/board](http://localhost:3000/board). Board uses **Next.js `/api/board`**. Do not set `NEXT_PUBLIC_BACKEND_URL`.

### Optional: FastAPI + Ollama agent

```bash
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Set in `.env.local`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

### Deploy (Vercel)

1. Deploy the Next.js app.
2. **Remove** `NEXT_PUBLIC_BACKEND_URL` if it points at localhost.
3. Optional: `EVALUATOR_URL` + `EVALUATOR_API_KEY` for cloud LLM board questions.
4. Optional: `NEXT_PUBLIC_SENTRY_DSN` for error reporting.

Plan: [speak_readme.md](./speak_readme.md) → [SpeakEasy_ROADMAP.md](./SpeakEasy_ROADMAP.md).

---

## Interview flow (as designed)

```text
DAF intake (saved locally, optional PDF)
        ↓
Fullscreen board room + camera proctor
        ↓
Q1     Welcome + brief introduction          (warm)
Q2–3   Polite DAF probes (state, degree…)    (courteous)
Q4+    Sharper, DAF-tied, sometimes current affairs
        ↓
If candidate says “please repeat…” → same Q spoken again (no advance)
        ↓
Answer (mic / type) → next question
```

---

## Key files

### Backend

```text
backend/
├── app/main.py
├── app/routes/board.py          # session / question / answer
├── app/routes/eval.py
├── app/agent/loop.py            # planner → tool → generator
├── app/agent/planner.py
├── app/agent/generator.py       # board-v3 phased prompts + fallbacks
├── app/agent/tools.py           # RSS current affairs
├── app/models.py · schemas.py · config.py
├── app/eval/cases/*.json
├── docker-compose.yml
└── README.md
```

### Frontend

```text
src/app/board/page.tsx
src/components/
  DAFIntakeForm.tsx
  BoardInterview.tsx
  BoardPanelRoom.tsx
  ProctorOverlay.tsx
src/lib/
  boardApi.ts · boardIntent.ts · boardPanel.ts · boardSpeech.ts
  dafOptions.ts · dafStorage.ts
  topics/board.ts
  proctor/faceMonitor.ts · types.ts
  useProctorCamera.ts
```

---

## API sketch

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness |
| `POST` | `/board/session` | Create profile + session from DAF JSON |
| `POST` | `/board/question` | Next board question + tool trace |
| `POST` | `/board/answer` | Store transcript + optional discipline violations |
| `POST` | `/eval/run` | Run eval harness |
| `GET` | `/eval/results` | Recent eval averages |

---

## Deploy notes

- **Vercel** hosts the Next.js app only. The board API is **local** (`:8000`) unless you host FastAPI separately and point `NEXT_PUBLIC_BACKEND_URL` at it.
- Do not commit `.env` / `.env.local` or `speakeasy_board.db`.

---

## Still open / future

- Hosted board API for production (not laptop-only)
- Richer DAF PDF parsing (auto-fill more fields)
- Higher-quality TTS (licensed neural voices — not cloned panelists)
- Stronger eval metrics and more seeded cases
- Deeper PSU viva technical banks

---

## Author

**Swetabh Salampuria** — Speakeasy / SpeakEasy.
