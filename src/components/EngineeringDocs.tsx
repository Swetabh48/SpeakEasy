"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { AuthButton } from "@/components/AuthButton";
import { BrandMark, Shell } from "@/components/Shell";
import { ThemeToggle } from "@/components/ThemeToggle";

const SECTIONS = [
  { id: "overview", label: "System Overview" },
  { id: "features", label: "Features" },
  { id: "tech-stack", label: "Tech Stack : What & Why" },
  { id: "modules", label: "Core Modules" },
  { id: "hld", label: "High-Level Design (HLD)" },
  { id: "flows", label: "System Flows" },
  { id: "data", label: "Data Design" },
  { id: "deep-dives", label: "Deep Dives" },
  { id: "future", label: "Future Enhancements" },
] as const;

const FEATURES = [
  {
    title: "Generative practice topics",
    body: "Combinatorial banks across modes, fields, and difficulty — not a short static list. Device fingerprints avoid repeats.",
  },
  {
    title: "Timed speak & essay sessions",
    body: "Prep and speak/write timers with exam-aware defaults. Speech uses MediaRecorder; essays support typing or PDF upload.",
  },
  {
    title: "In-browser transcription",
    body: "Whisper runs in the browser by default. Web Speech captions act as backup; optional cloud STT when keys are configured.",
  },
  {
    title: "Evidence-based scoring",
    body: "Weighted rubrics with a grading waterfall. Empty or unserious attempts score near zero. Local grader always available.",
  },
  {
    title: "On-device growth profile",
    body: "History, streak, and evaluation archive stay in localStorage for guests; signed-in users sync the same data to Supabase under RLS.",
  },
  {
    title: "Government board interview",
    body: "DAF intake, five-member spoken panel, follow-ups, silence-driven turns, advisory proctoring, and dual debrief reports.",
  },
  {
    title: "Same-origin board APIs",
    body: "Production board runs on Next.js /api/board so the live site works on any PC without a local FastAPI process.",
  },
  {
    title: "Optional local enrichment",
    body: "Point NEXT_PUBLIC_BACKEND_URL at FastAPI + Ollama for richer generation and an offline eval harness during development.",
  },
];

const TECH = [
  {
    title: "Application framework",
    name: "Next.js (App Router) + React",
    why: [
      "Single deployable surface for UI and APIs — ideal for a portfolio product on Vercel.",
      "Server routes keep evaluator keys off the client while pages stay fast and cacheable.",
    ],
  },
  {
    title: "Language",
    name: "TypeScript",
    why: [
      "Shared types across UI, API payloads, and board session shapes reduce interface drift.",
      "Makes rubric and DAF contracts explicit for contributors.",
    ],
  },
  {
    title: "Styling & motion",
    name: "Tailwind CSS + Framer Motion",
    why: [
      "Utility-first UI with a small token set (void / panel / accent) keeps the product coherent.",
      "Motion is used for stage transitions, not decoration noise.",
    ],
  },
  {
    title: "Speech-to-text",
    name: "Browser Whisper (@huggingface/transformers) + Web Speech API",
    why: [
      "Default path is private and free — models download once in the user’s browser.",
      "Captions cover flaky recognition; cloud Whisper remains optional.",
    ],
  },
  {
    title: "Evaluation",
    name: "EVALUATOR_URL → Ollama → local-strict grader",
    why: [
      "Remote examiner when you host one; Ollama for local research; local heuristics as reliability floor.",
      "Protects scoring integrity when models are down or answers lack evidence.",
    ],
  },
  {
    title: "Board orchestration",
    name: "BoardMemory + answer analyze → persona thread + optional FastAPI",
    why: [
      "Each turn understands the last answer, updates shared memory, and routes follow-ups to the owning panelist.",
      "Brain order: free hosted EVALUATOR_* (e.g. Groq) → Ollama speakeasy-board → banks. FastAPI optional for local tools/eval.",
    ],
  },
  {
    title: "Proctoring",
    name: "MediaPipe Tasks Vision",
    why: [
      "Client-side face / presence cues for discipline debrief without shipping video to a server by default.",
      "Keeps practice numeric scores honest to content, not camera heuristics.",
    ],
  },
  {
    title: "Deployment",
    name: "Vercel + custom domain (spkeasy.in)",
    why: [
      "CDN-backed Next hosting matches the App Router model.",
      "DNS points apex and www at Vercel; secrets stay in project env vars.",
    ],
  },
];

const MODULES = [
  {
    name: "PracticeApp",
    role: "Session state machine for filters, topic spin, timers, capture, and review.",
  },
  {
    name: "Topic engine",
    role: "Combinatorial generation, exam catalog, fingerprints, deep-research templates.",
  },
  {
    name: "Evaluation service",
    role: "POST /api/evaluate — rubric selection, model waterfall, local-strict fallback.",
  },
  {
    name: "BoardInterview",
    role: "DAF intake → live panel → silence handoff → debrief UI.",
  },
  {
    name: "boardAgent",
    role: "Personas, follow-up heuristics, question generation, in-memory session store.",
  },
  {
    name: "Profile / storage",
    role: "localStorage for guests; Supabase Postgres when signed in (evals, history, streak, settings, DAF).",
  },
  {
    name: "Proctor overlay",
    role: "Face / tab / fullscreen violations feeding the discipline report.",
  },
  {
    name: "Optional FastAPI",
    role: "Persistent board sessions, current-affairs tools, eval harness — local only.",
  },
];

const DIVES = [
  {
    title: "Why client-side topic generation?",
    body: "Topic spin should feel instant and cost nothing at scale for a practice studio. Combinatorial banks plus on-device fingerprints meet that bar without a topic microservice.",
  },
  {
    title: "Why a scoring waterfall?",
    body: "Remote models improve coaching quality when available, but competitive-exam feedback cannot go blank when APIs fail. local-strict is the always-on floor; LLM scores are capped when evidence is thin.",
  },
  {
    title: "Why same-origin /api/board?",
    body: "A board that requires uvicorn on the user’s laptop cannot be a public demo. Next routes keep production self-contained. Session Map volatility is an accepted v0 trade-off mitigated by resending profile and turns.",
  },
  {
    title: "Why optional accounts?",
    body: "Guest practice stays on-device for a short privacy story and zero-friction demos. Supabase Auth unlocks owned sync of evaluations, history, streak, and DAF across browsers — login is never required to practice or score.",
  },
];

function Accent({ children }: { children: ReactNode }) {
  return <span className="font-medium text-[var(--ink)]">{children}</span>;
}

export function EngineeringDocs() {
  const [active, setActive] = useState<string>("overview");
  const [openFeature, setOpenFeature] = useState<number | null>(0);

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      Boolean,
    ) as HTMLElement[];
    if (!nodes.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  return (
    <Shell>
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--void)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href="/" className="rounded-md transition hover:opacity-90">
            <BrandMark />
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
            <Link
              href="/"
              className="rounded-md px-3 py-2 text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              Home
            </Link>
            <Link
              href="/engineering"
              className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)]"
            >
              Engineering
            </Link>
            <Link
              href="/board"
              className="rounded-md px-3 py-2 text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              Board
            </Link>
            <a
              href="https://github.com/Swetabh48/SpeakEasy"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] transition hover:bg-[var(--panel-2)]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-current"
                aria-hidden
              >
                <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.3-3.3 4.3 4.3 0 0 1 .1-3.2s1-.3 3.4 1.2a11.7 11.7 0 0 1 6.2 0c2.3-1.5 3.3-1.2 3.3-1.2a4.3 4.3 0 0 1 .1 3.2 4.7 4.7 0 0 1 1.3 3.3c0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
              </svg>
              Github
            </a>
            <AuthButton next="/engineering" />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-md border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="mb-2 px-2 text-[11px] text-[var(--muted)]">
              Engineering
            </p>
            <nav className="space-y-0.5">
              {SECTIONS.map(({ id, label }) => {
                const on = active === id;
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    className={
                      on
                        ? "block rounded-md bg-[var(--panel-2)] px-2.5 py-2 text-sm font-medium text-[var(--ink)]"
                        : "block rounded-md px-2.5 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
                    }
                  >
                    {label}
                  </a>
                );
              })}
            </nav>
          </div>
        </aside>

        <article className="min-w-0 space-y-16 pb-20">
          <header className="space-y-3">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl">
              Speakeasy — Engineering Overview
            </h1>
            <p className="max-w-3xl text-lg text-[var(--ink)]">
              Deep dive into design, architecture, workflows, and core engineering
              decisions.
            </p>
          </header>

          {/* OVERVIEW */}
          <section id="overview" className="scroll-mt-28 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              System Overview
            </h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-[var(--muted)]">
              <p>
                Speakeasy is a <Accent>speech and essay practice studio</Accent> for
                competitive exams and open practice — generative topics, timed
                sessions, transcription, evidence-based scoring, and a local growth
                profile. Alongside practice sits a{" "}
                <Accent>government-style board interview</Accent> driven by a Detailed
                Application Form (DAF).
              </p>
              <p>
                The system is intentionally <Accent>client-heavy</Accent>: topic
                generation, capture, and default STT run in the browser. Thin{" "}
                <Accent>Next.js serverless APIs</Accent> handle evaluation and board
                orchestration on the same origin so the live product (
                <Accent>spkeasy.in</Accent>) works on any PC without a developer laptop
                process.
              </p>
              <p>
                This page is the engineering breakdown — requirements-shaped thinking,
                high-level design, data placement, critical flows, and the trade-offs
                behind v0.
              </p>
            </div>
          </section>

          {/* FEATURES */}
          <section id="features" className="scroll-mt-28 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              Features
            </h2>
            <div className="divide-y divide-[var(--line)] rounded-md border border-[var(--line)] bg-[var(--panel)]/50">
              {FEATURES.map((f, i) => {
                const open = openFeature === i;
                return (
                  <div key={f.title}>
                    <button
                      type="button"
                      onClick={() => setOpenFeature(open ? null : i)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--panel-2)]/60"
                    >
                      <span className="font-medium text-[var(--ink)]">{f.title}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[var(--accent)] transition ${open ? "rotate-180" : ""}`}
                      />
                    </button>
                    {open && (
                      <p className="px-4 pb-4 text-sm leading-relaxed text-[var(--muted)]">
                        {f.body}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* TECH STACK */}
          <section id="tech-stack" className="scroll-mt-28 space-y-6">
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
                Tech Stack : What & Why
              </h2>
              <p className="text-[var(--muted)]">
                Every choice below is tied to performance, privacy, deployability, or
                scoring integrity — not novelty for its own sake.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {TECH.map((t) => (
                <div
                  key={t.title}
                  className="rounded-md border border-[var(--line)] bg-[var(--panel)]/60 p-4"
                >
                  <p className="text-[11px] text-[var(--muted)]">
                    {t.title}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-[var(--ink)]">
                    {t.name}
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                    {t.why.map((w) => (
                      <li key={w} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-md bg-[var(--accent)]" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* MODULES */}
          <section id="modules" className="scroll-mt-28 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              Core Modules
            </h2>
            <p className="text-[var(--muted)]">
              Speakeasy is a modular monolith on Next.js — clear domain boundaries
              without eight deployable microservices (unnecessary for v0 scale).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODULES.map((m) => (
                <div
                  key={m.name}
                  className="rounded-md border border-[var(--line)] bg-[var(--panel)]/50 p-4"
                >
                  <h3 className="font-semibold text-[var(--ink)]">{m.name}</h3>
                  <p className="mt-1.5 text-sm text-[var(--muted)]">{m.role}</p>
                </div>
              ))}
            </div>
          </section>

          {/* HLD */}
          <section id="hld" className="scroll-mt-28 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              High-Level Design (HLD)
            </h2>
            <p className="text-[var(--muted)]">
              Interactive-style architecture map: clients → same-origin Next APIs →
              data stores and optional external / local services.
            </p>
            <div className="w-full rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 sm:p-6">
              <div className="w-full overflow-x-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/developers/speakeasy-hld.svg?v=4"
                  alt="Speakeasy high-level architecture diagram"
                  className="mx-auto h-auto w-full min-w-[720px] max-w-6xl border border-[var(--line)] bg-[var(--panel-2)]"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/developers/speakeasy-hld.excalidraw"
                download
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--panel)] px-4 text-sm text-[var(--ink)] transition hover:bg-[var(--panel-2)]"
              >
                Download Excalidraw
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href="/developers/speakeasy-hld.svg"
                download
                className="inline-flex h-10 items-center rounded-md border border-[var(--line)] px-4 text-sm text-[var(--muted)] transition hover:border-[var(--muted)]"
              >
                Download SVG
              </a>
              <a
                href="https://excalidraw.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-md border border-[var(--line)] px-4 text-sm text-[var(--muted)] transition hover:border-[var(--muted)]"
              >
                Edit in Excalidraw.com
              </a>
            </div>
          </section>

          {/* FLOWS */}
          <section id="flows" className="scroll-mt-28 space-y-6">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              System Flows
            </h2>
            <p className="text-[var(--muted)]">
              Critical request paths — same style as architecture deep-dives: one
              diagram per flow.
            </p>

            <div className="space-y-8">
              <div>
                <h3 className="mb-3 font-semibold text-[var(--ink)]">
                  Practice session flow
                </h3>
                <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 sm:p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/developers/practice-flow.svg?v=4"
                    alt="Practice session flow diagram"
                    className="mx-auto h-auto w-full max-w-5xl rounded-lg"
                  />
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-semibold text-[var(--ink)]">
                  Board interview flow
                </h3>
                <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-3 sm:p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/developers/board-flow.svg?v=4"
                    alt="Board interview flow diagram"
                    className="mx-auto h-auto w-full max-w-5xl rounded-lg"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* DATA */}
          <section id="data" className="scroll-mt-28 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              Data Design
            </h2>
            <p className="text-[var(--muted)]">
              v0 stores learner state on the device. Server state for board is
              ephemeral on the Next path; optional FastAPI persists when used locally.
            </p>
            <div className="overflow-x-auto rounded-md border border-[var(--line)]">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-[var(--panel)] text-[11px] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Where</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)] text-[var(--muted)]">
                  {[
                    ["Topic / SeenTopic", "localStorage (+ cloud)", "Fingerprints; synced in user_state when signed in"],
                    ["PracticeAttempt / History", "localStorage (+ cloud)", "Guest local; practice_history when signed in"],
                    ["Evaluation / StoredEval", "localStorage (+ cloud)", "Guest local; evaluations table when signed in"],
                    ["CandidateProfile (DAF)", "localStorage (+ cloud)", "Guest local; user_state.daf when signed in"],
                    ["BoardSession / Turns", "Next memory Map", "UUID session; client may resend turns"],
                    ["BoardSession (optional)", "FastAPI SQL", "Durable when NEXT_PUBLIC_BACKEND_URL is set"],
                    ["Violations", "Client → debrief", "Advisory proctor / conduct events"],
                  ].map(([a, b, c]) => (
                    <tr key={a} className="bg-[var(--panel)]/30">
                      <td className="px-4 py-3 text-[var(--ink)]">{a}</td>
                      <td className="px-4 py-3 text-[var(--accent)]">{b}</td>
                      <td className="px-4 py-3">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* DEEP DIVES */}
          <section id="deep-dives" className="scroll-mt-28 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              Deep Dives
            </h2>
            <div className="space-y-3">
              {DIVES.map((d) => (
                <div
                  key={d.title}
                  className="rounded-md border border-[var(--line)] bg-[var(--panel)]/50 p-4"
                >
                  <h3 className="font-semibold text-[var(--ink)]">{d.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    {d.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* FUTURE */}
          <section id="future" className="scroll-mt-28 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              Future Enhancements
            </h2>
            <ul className="space-y-2 text-[var(--muted)]">
              {[
                "Done: optional Supabase Auth + per-user ownership of evaluations / history / DAF",
                "Durable board session store (Redis or SQL) for serverless multi-instance",
                "Rate limits and spend caps on evaluate / transcribe when paid keys are set",
                "Async queues for heavy STT on low-end devices",
                "Account delete + export for profile archives (retention policy)",
                "Numeric board scoring aligned with practice rubrics + longitudinal trends",
              ].map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-md bg-[var(--accent)]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <footer className="border-t border-[var(--line)] pt-8 text-sm text-[var(--muted)]">
            <p>
              Speakeasy engineering notes ·{" "}
              <a
                href="https://github.com/Swetabh48/SpeakEasy"
                className="text-[var(--muted)] underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Github
              </a>{" "}
              ·{" "}
              <Link href="/" className="text-[var(--muted)] underline-offset-2 hover:underline">
                back to practice
              </Link>
            </p>
          </footer>
        </article>
      </div>
    </Shell>
  );
}
