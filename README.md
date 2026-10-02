# Speakeasy

**Think quick. Speak clear.**

Speakeasy is a speech and essay practice studio for competitive exams and open practice. It provides generative topics, prep/speak timers, recording, transcription, evidence-based scoring, local progress graphs, and coaching tips. Government board interview practice runs at `/board`.

Live app: [spkeasy.in](https://spkeasy.in)

System design notes (engineering): [spkeasy.in/engineering](https://spkeasy.in/engineering)

Repository: [github.com/Swetabh48/SpeakEasy](https://github.com/Swetabh48/SpeakEasy)

---

## Features

| Capability | Details |
|---|---|
| **Generative topics** | Combinatorial banks (subjects × regions × angles × templates) |
| **No repeats on device** | Topic fingerprints in `localStorage` |
| **Practice modes** | Impromptu, Debate, Interview, IELTS / Fluency, Group Discussion, Pitch, Essay, Deep research |
| **Field filters** | Governance, economy, science, ethics, health, sports, tech, international affairs, custom fields |
| **Optional exam scope** | Searchable exam picker; open practice if none selected |
| **Timers** | Prep + speak/write, including custom durations |
| **Speaking sessions** | MediaRecorder + live captions backup + in-browser Whisper transcription |
| **Essay sessions** | Typing or PDF upload (`pdfjs-dist`) |
| **Evidence-based scoring** | Empty / unserious attempts score near zero |
| **Session review** | Dimension scores, coaching tips, transcript, optional playback |
| **Profile & growth** | `/profile`: trajectory chart, mode mix, rubric averages, strengths / weaknesses |
| **Board interview** | Fullscreen UPSC / IES / IFS / PSU panel at `/board`: DAF intake, five-member spoken panel, questions via Next.js `/api/board` |

---

## Architecture

See the interactive write-up at **`/engineering`** (live: [spkeasy.in/engineering](https://spkeasy.in/engineering)).

Editable high-level diagram:
- SVG: [`public/developers/speakeasy-hld.svg`](./public/developers/speakeasy-hld.svg)
- Excalidraw: [`public/developers/speakeasy-hld.excalidraw`](./public/developers/speakeasy-hld.excalidraw) — open in [excalidraw.com](https://excalidraw.com) via Import
- Regenerate Excalidraw: `node scripts/generate-hld-excalidraw.mjs`

```text
PracticeSpeaking/
├── src/app/
│   ├── page.tsx                 # Home → PracticeApp
│   ├── profile/page.tsx         # Growth dashboard
│   ├── board/page.tsx           # Govt board interview room
│   ├── api/evaluate/route.ts    # Server evaluation
│   ├── api/board/               # Board session / question / answer / debrief / health
│   ├── api/transcribe/route.ts  # Optional cloud Whisper fallback
│   ├── icon.tsx
│   └── layout.tsx
├── src/components/
│   ├── PracticeApp.tsx          # Practice UX / session state machine
│   ├── BoardInterview.tsx       # DAF → live panel → answers → debrief
│   ├── DAFIntakeForm.tsx
│   ├── ExamPicker.tsx
│   ├── ProfileView.tsx
│   └── Shell.tsx
├── src/lib/
│   ├── topics/                  # Banks, exams, fields, engine, fingerprints
│   ├── evaluation/              # Rubrics, remote examiner, Ollama, local grader
│   ├── boardAgent/              # In-process board orchestration (personas, follow-ups, debrief)
│   ├── boardApi.ts · daf*.ts    # Board client, TTS, intent, DAF storage
│   ├── proctor/                 # Face / discipline monitoring
│   ├── whisperTranscribe.ts
│   ├── useAudioRecorder.ts
│   ├── useBackupSpeechTranscript.ts
│   ├── usePracticeTimer.ts
│   ├── profile.ts
│   └── storage.ts
├── backend/                     # Optional FastAPI board agent (local :8000)
└── .env.example
```

### Tech stack

- **Next.js** (App Router) · **React** · **TypeScript**
- **Tailwind CSS** · **Framer Motion** · **Lucide**
- **pdfjs-dist** · **@huggingface/transformers** (Whisper in browser)
- Optional: **Ollama** or any chat-completions examiner HTTP API
- Optional local backend: **FastAPI** + SQLAlchemy (SQLite by default)

### Data flow — speaking practice

```text
Home filters → Spin topic → Prep timer → Speak timer
       │                                    │
       │                         MediaRecorder (audio blob)
       │                         + Web Speech API (live captions)
       ▼                                    ▼
                              Review: Whisper (browser) vs captions
                              → POST /api/evaluate
                                              ▼
                              Strict score + tips → localStorage profile / history
```

### Data flow — board interview

```text
DAF intake → POST /api/board/session
       → panel greets / asks (TTS)
       → mic answer (silence advances turn)
       → POST /api/board/answer → next question or follow-up
       → debrief (Board + Discipline reports)
```

Production uses same-origin `/api/board/*` (works on Vercel for any PC).  
Optional: set `NEXT_PUBLIC_BACKEND_URL` to a local FastAPI instance for Ollama-backed generation.

### Scoring priority (`src/lib/evaluation/openSource.ts`)

1. `EVALUATOR_URL` — hosted chat-completions examiner  
2. Ollama at `OLLAMA_BASE_URL`  
3. Strict local grader in `localScore.ts` (always available)

### Storage & privacy

**Guest (default):** progress stays on-device (`localStorage`) — topic fingerprints, history, streaks, evaluation archive, DAF.

**Signed-in (optional):** the same data syncs to Supabase Postgres under your user id (RLS). Practice never requires an account.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then run [`supabase/migrations/001_user_owned.sql`](./supabase/migrations/001_user_owned.sql) in the Supabase SQL editor. Enable Email magic link and Google OAuth in Authentication → Providers. Add the site URL and `/auth/callback` redirect.

Audio and transcripts stay in the browser unless you configure a remote evaluator or Whisper API. Do not commit `.env.local`.

---

## Local development

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env.local   # optional
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Board: [http://localhost:3000/board](http://localhost:3000/board).

Leave `NEXT_PUBLIC_BACKEND_URL` unset so the app uses `/api/board`.

### Optional FastAPI backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then in `.env.local`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |

### Optional remote examiner

```bash
EVALUATOR_URL=
EVALUATOR_MODEL=speakeasy-examiner
EVALUATOR_API_KEY=

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:latest
```

Without these, Speakeasy scores with the strict local grader.

Speech scoring works best in **Chrome** or **Edge**.

---

## Deploy on Vercel

1. Import [Swetabh48/SpeakEasy](https://github.com/Swetabh48/SpeakEasy) on [vercel.com/new](https://vercel.com/new).
2. Framework: **Next.js**.
3. Do **not** set `NEXT_PUBLIC_BACKEND_URL` to localhost.
4. Optionally set `EVALUATOR_URL` / `EVALUATOR_API_KEY` for a public examiner.
5. Deploy.

```bash
npx vercel --prod
```

Whisper models download in the user’s browser on first use. Serverless evaluation uses the local grader unless `EVALUATOR_URL` is set.

---

## Author

**Swetabh Salampuria** ([@Swetabh48](https://github.com/Swetabh48)) — sole author and contributor.

---

## License

Private / personal project unless a license file is added later.
