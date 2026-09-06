# Data retention & consent (SpeakEasy)
**Status:** Phase 0 one-pager · aligns with SpeakEasy_ROADMAP.md §5  
**Not legal advice** — refine before charging money / shipping accounts (Phase 1).

## What we collect today (V0)

| Data | Where it lives | Retention |
|---|---|---|
| Practice history, scores, streaks, seen topics | Browser `localStorage` on the user's device | Until the user clears site data |
| DAF fields (name, state, education, hobbies, etc.) | Browser `localStorage` (+ optional PDF text kept in that save) | Until cleared by user |
| Board session turns / violations | In-memory on the server for the request lifetime; client holds the transcript for debrief | Not written to a Speakeasy cloud DB in V0 |
| Mic audio | Processed in-browser (Whisper) or optional cloud Whisper if user/env enables it | Not stored by Speakeasy servers in V0 |

## Consent principles

1. **Microphone / camera** — requested by the browser; user can deny. Board proctoring camera is for the live session only.
2. **Optional DAF PDF upload** — not required; text extraction stays on-device / session-scoped.
3. **No account yet** — we cannot sync or recover data across devices; clearing the browser wipes progress.
4. **Future accounts (Phase 1)** — will need explicit opt-in for server-side transcript/score logging, deletion-on-request, and a DPDP-aligned notice before monetization.

## User controls (V0)

- Clear site data / localStorage for Speakeasy to wipe progress and saved DAF.
- Do not upload sensitive PDFs you are not willing to process in the browser.
- Leave cloud Whisper / evaluator API keys unset unless you accept third-party processing.

## Audio & DAF

Voice and Detailed Application Form fields are sensitive for government-exam aspirants. Speakeasy V0 keeps them **device-local** by default. Any move to server persistence must ship with retention limits, export/delete, and consent copy before Phase 1 auth.
