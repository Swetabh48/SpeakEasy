# Speakeasy

**Think quick. Speak clear.**

Speakeasy is a speech and essay practice studio for competitive exams and open practice. You get generative topics, prep/speak timers, recording, transcription, strict evidence-based scoring, local progress graphs, and coaching tips — without relying on proprietary cloud models by default.

Live app (after deploy): connect your Vercel URL here.

Repository: [github.com/Swetabh48/SpeakEasy](https://github.com/Swetabh48/SpeakEasy)

---

## What you can do

| Capability | Details |
|---|---|
| **Generative topics** | Combinatorial banks (subjects × regions × angles × templates) so the space stays huge; not a short static list |
| **No repeats on device** | Topic fingerprints stored in `localStorage` so you do not get the same prompt again on that browser |
| **Practice modes** | Impromptu, Debate, Interview, IELTS / Fluency, Group Discussion, Pitch, Essay topic, Deep research |
| **Field filters** | Domains across governance, economy, science, ethics, health, sports, tech, international affairs, plus custom free-text fields |
| **Optional exam scope** | Searchable exam picker (speaking / essay / interview-relevant exams only). Open practice if none selected |
| **Timers** | Prep + speak (or write) seconds, including custom durations. Essay defaults ~1m prep / 10m write. Deep research defaults ~10m research → 1–5m speak |
| **Speaking sessions** | Mic recording (MediaRecorder) + live browser captions backup + Whisper-in-browser transcription of the full clip |
| **Essay sessions** | Typing or PDF upload (`pdfjs-dist`); optional “end without score” |
| **Evidence-based scoring** | Empty / unserious attempts score near zero. No participation marks |
| **Session review** | Dimension scores, coaching tips, transcript, optional playback |
| **Profile & growth** | Dedicated `/profile` page: score trajectory chart, mode mix, rubric averages, strengths / weaknesses, recent evaluations |
| **History & streaks** | Local device history and streak counters |

---

## How a speaking session works

```text
Home filters → Spin topic → Prep timer → Speak timer
       │                                    │
       │                         MediaRecorder (audio blob)
       │                         + Web Speech API (live captions backup)
       ▼                                    ▼
                              Review: Whisper (browser) prefers longer text
                              vs backup captions → send transcript to /api/evaluate
                                              ▼
                              Strict score + tips → saved to profile / history
```

1. Pick mode, field, difficulty, timers; optionally pick an exam.
2. Spin a topic (and “another topic” if needed).
3. Prep, then speak. Audio is recorded; live captions may pause briefly (Chrome’s Web Speech API is flaky) — Speakeasy restarts recognition and still scores from the recording.
4. On finish, Whisper tries to transcribe the blob in the browser; the longer of Whisper vs captions is used.
5. `/api/evaluate` scores the attempt and returns rubric dimensions + coaching.

**Browser note:** Scoring speech works best in **Chrome** or **Edge**. Cursor’s embedded browser and some WebViews fail Whisper / Speech APIs even when playback audio sounds fine.

---

## How scoring works

Priority order in `src/lib/evaluation/openSource.ts`:

1. **`EVALUATOR_URL`** — your hosted OpenAI-compatible examiner (`/v1/chat/completions`)
2. **Ollama** — local models at `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)
3. **Strict local grader** — always available, low RAM, evidence-based heuristics in `localScore.ts`

Whisper (`@huggingface/transformers`) runs **in the browser** for STT. Server evaluation never invents high marks from silence.

Copy rules:
- With an exam selected → “Evaluating against exam standards…”
- Open practice → “Evaluating…”

Raw ONNX / stack traces are never shown in the UI.

---

## Architecture

```text
PracticeSpeaking/
├── src/app/
│   ├── page.tsx              # Home → PracticeApp
│   ├── profile/page.tsx      # Growth dashboard
│   ├── api/evaluate/route.ts # Server evaluation endpoint
│   ├── icon.tsx              # Speakeasy “S” favicon
│   └── layout.tsx            # Fonts + metadata
├── src/components/
│   ├── PracticeApp.tsx       # Main practice UX / session state machine
│   ├── ExamPicker.tsx        # Searchable exam list
│   ├── ProfileView.tsx       # Charts + stats page
│   └── Shell.tsx             # Layout shell, brand mark, chips, panels
├── src/lib/
│   ├── topics/               # Banks, exams, fields, engine, fingerprints, deep research
│   ├── evaluation/           # Types, rubrics, Ollama/custom API, local grader
│   ├── whisperTranscribe.ts  # Browser Whisper with dtype fallbacks
│   ├── useAudioRecorder.ts
│   ├── useBackupSpeechTranscript.ts
│   ├── usePracticeTimer.ts
│   ├── profile.ts            # localStorage evaluations + aggregates
│   └── storage.ts            # History, streak, seen topics, settings
└── .env.example              # Evaluator / Ollama configuration
```

### Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS 4** · **Framer Motion** · **Lucide**
- **pdfjs-dist** (essay PDF text)
- **@huggingface/transformers** (Whisper in-browser)
- Optional: **Ollama** or any OpenAI-compatible examiner HTTP API

### Storage

All progress is **on-device** (`localStorage`): seen topic fingerprints, history, streaks, evaluation archive for `/profile`. No account system in v0.1.

---

## Local development

Requirements: Node.js 20+ recommended.

```bash
npm install
cp .env.example .env.local   # optional — edit evaluator / Ollama settings
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |

### Optional AI evaluator

Copy `.env.example` → `.env.local`:

```bash
# Hosted OpenAI-compatible examiner
EVALUATOR_URL=
EVALUATOR_MODEL=speakeasy-examiner
EVALUATOR_API_KEY=

# Or Ollama on this machine
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
```

Without these, Speakeasy still scores with the **strict local grader**.

---

## Deploy on Vercel (recommended)

Vercel is the best fit for Next.js.

1. Push this repo to GitHub (already: `Swetabh48/SpeakEasy`).
2. Go to [vercel.com/new](https://vercel.com/new) → import **SpeakEasy**.
3. Framework preset: **Next.js** (auto-detected).
4. Add env vars if you want Ollama/remote evaluator **from production** (Ollama on your laptop will *not* be reachable from Vercel — use `EVALUATOR_URL` on a public HTTPS endpoint, or rely on the built-in local grader + browser Whisper).
5. Deploy.

CLI option (after `npx vercel login`):

```bash
npx vercel --prod
```

### Production notes

- **Whisper** downloads models in the user’s browser (first speak may take a bit).
- **Serverless** evaluation uses the local grader unless you set `EVALUATOR_URL`.
- Do not commit `.env.local`.

---

## Author

**Swetabh Salampuria** ([@Swetabh48](https://github.com/Swetabh48)) — sole contributor.

---

## License

Private / personal project unless you add a license file later.
