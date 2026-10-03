"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import {
  BrandMark,
  Panel,
  Shell,
  SiteFooter,
  TRUSTED_MARKS,
} from "@/components/Shell";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  createClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { authCallbackUrl, getClientSiteUrl } from "@/lib/supabase/siteUrl";

function friendlyAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("over_email_send_rate_limit")) {
    return "Too many email attempts. Wait a minute, or continue with Google.";
  }
  if (
    lower.includes("provider is not enabled") ||
    lower.includes("unsupported provider") ||
    lower.includes("validation_failed")
  ) {
    return "Google isn’t enabled on this Supabase project yet. Enable Google under Authentication → Providers, or wait and retry email.";
  }
  if (lower.includes("email") && (lower.includes("not enabled") || lower.includes("disabled"))) {
    return "Email sign-in isn’t enabled yet in Supabase → Authentication → Providers.";
  }
  const cleaned = raw
    .replace(/^\{.*"msg"\s*:\s*"/i, "")
    .replace(/"\s*\}.*$/, "")
    .replace(/^["{].*/, "")
    .slice(0, 180);
  return cleaned || "Sign-in failed. Try again in a moment.";
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const errParam =
    searchParams.get("error") ||
    searchParams.get("error_description") ||
    searchParams.get("error_code");

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"idle" | "email" | "google">("idle");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) router.replace(next);
    });
    return () => {
      cancelled = true;
    };
  }, [configured, next, router]);

  useEffect(() => {
    if (!errParam) return;
    const raw = decodeURIComponent(String(errParam));
    setStatus("error");
    setMessage(friendlyAuthError(raw));
  }, [errParam]);

  async function sendMagicLink(e: FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setBusy("email");
    setStatus("idle");
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: authCallbackUrl(getClientSiteUrl(), next),
        },
      });
      if (error) {
        setStatus("error");
        setMessage(friendlyAuthError(error.message));
        return;
      }
      setStatus("sent");
      setMessage("Check your email for the magic link. Then you’ll land in the studio.");
    } catch (err) {
      setStatus("error");
      setMessage(
        friendlyAuthError(err instanceof Error ? err.message : "Sign-in failed"),
      );
    } finally {
      setBusy("idle");
    }
  }

  async function signInWithGoogle() {
    if (!configured) return;
    setBusy("google");
    setStatus("idle");
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authCallbackUrl(getClientSiteUrl(), next),
          skipBrowserRedirect: false,
        },
      });
      if (error) {
        setStatus("error");
        setMessage(friendlyAuthError(error.message));
        setBusy("idle");
      }
    } catch (err) {
      setStatus("error");
      setMessage(
        friendlyAuthError(
          err instanceof Error ? err.message : "Google sign-in failed",
        ),
      );
      setBusy("idle");
    }
  }

  return (
    <Panel className="w-full p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
        Sign in
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
        Access practice, board interviews, and your synced profile.
      </p>

      {!configured && (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--void)] p-3 text-sm text-[var(--muted)]">
          Add Supabase URL + anon key to{" "}
          <code className="text-[var(--ink)]">.env.local</code>.
        </div>
      )}

      {(status !== "idle" || message) && (
        <p
          className={`mt-4 text-sm ${
            status === "sent" ? "text-[var(--accent-deep)]" : "text-red-700"
          }`}
        >
          {message}
        </p>
      )}

      <form onSubmit={sendMagicLink} className="mt-5 space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-[var(--muted)]">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!configured || busy !== "idle"}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--void)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={!configured || busy !== "idle"}
          className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-[var(--accent)] text-base font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "email" ? "Sending…" : "Continue with email"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        or
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={!configured || busy !== "idle"}
        className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border border-[var(--line)] bg-[var(--panel)] text-base font-semibold text-[var(--ink)] shadow-[var(--shadow-sm)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GoogleGlyph />
        {busy === "google" ? "Opening Google…" : "Continue with Google"}
      </button>
    </Panel>
  );
}

function SessionPreview() {
  return (
    <div className="rounded-[1.5rem] bg-[var(--stage)] p-2.5 sm:p-3">
      <Panel className="overflow-hidden p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Live session
            </p>
            <p className="mt-1 font-display text-lg font-semibold">
              Impromptu · Economy
            </p>
          </div>
          <span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-deep)]">
            2:00 speak
          </span>
        </div>
        <p className="rounded-xl bg-[var(--void)] p-3 text-sm leading-relaxed text-[var(--ink)]">
          “Should India prioritize green hydrogen over solar capacity expansion
          in the next decade?”
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Clarity", "86"],
            ["Structure", "78"],
            ["Evidence", "82"],
          ].map(([label, score]) => (
            <div
              key={label}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel-2)]/60 p-2.5 text-center"
            >
              <p className="text-[10px] font-medium text-[var(--muted)]">
                {label}
              </p>
              <p className="mt-0.5 font-display text-xl font-semibold text-[var(--accent-deep)]">
                {score}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--panel-2)]">
          <div className="h-full w-[82%] rounded-full bg-[var(--accent)]" />
        </div>
        <p className="mt-1.5 text-right text-[11px] font-medium text-[var(--muted)]">
          Overall 82 · evidence floor active
        </p>
      </Panel>
    </div>
  );
}

function SpeakingMock() {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--void)] p-4">
      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <span className="font-medium text-[var(--ink)]">Prep complete</span>
        <span className="rounded-full bg-[var(--soft)] px-2.5 py-0.5 font-semibold text-[var(--accent-deep)]">
          1:42 left
        </span>
      </div>
      <div className="mt-4 flex h-16 items-end gap-1">
        {[40, 62, 48, 78, 55, 88, 50, 72, 58, 82, 46, 70, 60, 85].map((h, i) => (
          <span
            key={i}
            className="w-full rounded-sm bg-[var(--accent)]/80"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <p className="mt-3 text-sm leading-snug text-[var(--ink)]">
        “Green hydrogen needs transmission build-out first, or solar alone won’t…”
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs">
        <span className="text-[var(--muted)]">Clarity · Structure · Evidence</span>
        <span className="font-semibold text-[var(--accent-deep)]">Live STT</span>
      </div>
    </div>
  );
}

function BoardMock() {
  const members = [
    { initials: "DM", role: "Chair", color: "#0d5c38" },
    { initials: "SI", role: "Member", color: "#168a55" },
    { initials: "RK", role: "Member", color: "#2a9d8f" },
    { initials: "AP", role: "Member", color: "#5a6f64" },
    { initials: "NV", role: "Member", color: "#0c1f16" },
  ];
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--void)] p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--ink)]">Board room</span>
        <span className="text-[var(--muted)]">Round 2 · follow-up</span>
      </div>
      <div className="mt-4 flex justify-center gap-2 sm:gap-3">
        {members.map((m) => (
          <div key={m.initials} className="flex flex-col items-center gap-1">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-[var(--shadow-sm)]"
              style={{ background: m.color }}
            >
              {m.initials}
            </span>
            <span className="text-[10px] text-[var(--muted)]">{m.role}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-xl bg-[var(--panel)] px-3 py-2.5 text-sm text-[var(--ink)]">
        Chair: “What trade-offs did you leave out of your first answer?”
      </p>
    </div>
  );
}

function EssayMock() {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--void)] p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--ink)]">Essay · 600s</span>
        <span className="text-[var(--muted)]">412 words</span>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-[92%] rounded-full bg-[var(--panel-2)]" />
        <div className="h-2 w-[84%] rounded-full bg-[var(--panel-2)]" />
        <div className="h-2 w-[96%] rounded-full bg-[var(--panel-2)]" />
        <div className="h-2 w-[70%] rounded-full bg-[var(--panel-2)]" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="text-[11px] text-[var(--muted)]">Structure</p>
          <p className="font-display text-xl font-semibold text-[var(--accent-deep)]">
            81
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="text-[11px] text-[var(--muted)]">Evidence</p>
          <p className="font-display text-xl font-semibold text-[var(--accent-deep)]">
            74
          </p>
        </div>
      </div>
    </div>
  );
}

function ProfileMock() {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--void)] p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--ink)]">Score trajectory</span>
        <span className="font-semibold text-[var(--accent-deep)]">Avg 64</span>
      </div>
      <div className="mt-4 flex h-20 items-end gap-1.5">
        {[42, 48, 45, 58, 61, 55, 68, 72, 70, 78].map((h, i) => (
          <span
            key={i}
            className="w-full rounded-t-md bg-[var(--accent)]/80"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Weak area flagged: evidence depth
      </p>
    </div>
  );
}

function ExamMock() {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--void)] p-4">
      <p className="text-xs font-medium text-[var(--ink)]">Scoped to exam</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["UPSC", "IELTS", "CAT", "Bank PO", "RBI Grade B"].map((exam, i) => (
          <span
            key={exam}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              i === 0
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)]"
            }`}
          >
            {exam}
          </span>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
        Topics, timers, and rubrics shift to match the exam, or stay open for
        any field you type.
      </p>
    </div>
  );
}

const STAGE_FEATURES = [
  {
    id: "speak",
    title: "Timed speaking drills",
    body: "Prep + speak timers with live transcription. Scores stick to what you said.",
    Mock: SpeakingMock,
  },
  {
    id: "board",
    title: "Board interview room",
    body: "Five panelists, spoken turns, follow-ups. Closer to the real board.",
    Mock: BoardMock,
  },
  {
    id: "essay",
    title: "Essay mode",
    body: "Write against the clock or upload a PDF. Structure and evidence first.",
    Mock: EssayMock,
  },
  {
    id: "exams",
    title: "Exam-scoped topics",
    body: "UPSC to Bank PO, or open practice across any field you need.",
    Mock: ExamMock,
  },
  {
    id: "profile",
    title: "Synced profile",
    body: "History, weak areas, and trajectory follow your account across devices.",
    Mock: ProfileMock,
  },
] as const;

function FeatureStage() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || paused) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % STAGE_FEATURES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [mounted, paused]);

  const current = STAGE_FEATURES[active];
  const ActiveMock = current.Mock;

  return (
    <section
      className="grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div>
        <p className="text-sm font-semibold text-[var(--accent)]">Studio</p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          Pick a mode. Watch it work.
        </h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--muted)]">
          Auto-plays through each mode. Hover or tap to take over.
        </p>

        <ol className="mt-8 space-y-0.5">
          {STAGE_FEATURES.map((f, i) => {
            const on = i === active;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPaused(true);
                    setActive(i);
                  }}
                  onFocus={() => {
                    setPaused(true);
                    setActive(i);
                  }}
                  className={`flex w-full items-start gap-4 rounded-2xl px-3 py-3.5 text-left transition ${
                    on
                      ? "bg-[var(--panel)] shadow-[var(--shadow-sm)]"
                      : "hover:bg-[var(--panel)]/60"
                  }`}
                >
                  <span
                    className={`mt-0.5 font-mono text-xs font-medium ${
                      on ? "text-[var(--accent)]" : "text-[var(--muted)]"
                    }`}
                  >
                    0{i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block font-display text-xl font-semibold tracking-tight sm:text-2xl ${
                        on ? "text-[var(--ink)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {f.title}
                    </span>
                    {on && (
                      <span className="mt-1 block text-sm leading-relaxed text-[var(--muted)]">
                        {f.body}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="lg:sticky lg:top-8">
        <div className="rounded-[1.5rem] bg-[var(--stage)] p-2.5">
          <div className="mb-2 flex items-center justify-between px-1 text-xs text-white/75">
            <span>Live preview</span>
            <span className="font-mono">
              {active + 1}/{STAGE_FEATURES.length}
            </span>
          </div>
          <div
            key={current.id}
            className="animate-[fadeLift_220ms_ease-out] rounded-[1.15rem] bg-[var(--panel)] p-2 shadow-[var(--shadow)]"
          >
            <ActiveMock />
          </div>
          <div className="mt-2 flex gap-1.5 px-0.5">
            {STAGE_FEATURES.map((f, i) => (
              <button
                key={f.id}
                type="button"
                aria-label={`Show ${f.title}`}
                onClick={() => {
                  setPaused(true);
                  setActive(i);
                }}
                className={`h-1 flex-1 rounded-full transition ${
                  i === active ? "bg-[var(--accent)]" : "bg-[var(--ink)]/25"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustedStrip() {
  // Repeat until one segment is wider than the strip, then clone it once for a seamless -50% loop.
  const segment = [...TRUSTED_MARKS, ...TRUSTED_MARKS, ...TRUSTED_MARKS, ...TRUSTED_MARKS];
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
      <div className="border-b border-[var(--line)] px-5 py-3 sm:px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Trusted by aspirants preparing for
        </p>
      </div>
      <div className="relative overflow-hidden py-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--panel)] to-transparent sm:w-14" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--panel)] to-transparent sm:w-14" />
        <div className="animate-marquee flex w-max">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex shrink-0 gap-3 pr-3"
              aria-hidden={copy === 1}
            >
              {segment.map((mark, i) => (
                <span
                  key={`${copy}-${mark}-${i}`}
                  className="inline-flex shrink-0 items-center rounded-full border border-[var(--accent)]/30 bg-[var(--soft)] px-4 py-2 text-sm font-semibold tracking-wide text-[var(--accent-deep)]"
                >
                  {mark}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Shell>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <BrandMark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="rounded-full border border-[var(--line)] bg-[var(--panel)]/80 px-3 py-1.5 text-xs font-medium text-[var(--muted)] shadow-[var(--shadow-sm)]">
            Sign in required
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-5 pb-10 sm:gap-24 sm:px-8 sm:pb-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)]/80 px-3 py-1 text-xs font-semibold text-[var(--ink)] shadow-[var(--shadow-sm)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Speech & essay practice
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Speakeasy
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-[var(--muted)]">
              Timed speaking and essays with exam-style feedback. Scores reflect
              what you actually said or wrote, not empty praise.
            </p>
          </div>

          <div className="relative">
            <Suspense
              fallback={
                <Panel className="w-full p-8 text-sm text-[var(--muted)]">
                  Loading…
                </Panel>
              }
            >
              <SignInForm />
            </Suspense>
          </div>
        </section>

        <TrustedStrip />

        <section className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Platform</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Practice that actually grades you
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--muted)]">
              Spin a topic, speak or write against the clock, then get dimension
              scores grounded in what you produced, not filler praise.
            </p>
          </div>
          <div className="lg:sticky lg:top-8">
            <SessionPreview />
          </div>
        </section>

        <FeatureStage />

        <section className="grid gap-8 border-t border-[var(--line)] pt-14 lg:grid-cols-[1fr_1fr] lg:gap-12">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Integrity</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Honest sessions, synced progress
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--muted)]">
              Optional camera checks keep practice honest. Sign in once and your
              history, weak areas, and score trajectory follow you.
            </p>
          </div>
          <dl className="space-y-0">
            {[
              ["Proctor", "Face + tab focus checks"],
              ["Cloud profile", "Sync across devices"],
              ["Evidence floor", "Empty answers score near 0"],
              ["Exam filters", "UPSC to Bank PO"],
            ].map(([title, body]) => (
              <div
                key={title}
                className="flex items-baseline gap-4 border-b border-[var(--line)] py-3.5 first:pt-0"
              >
                <dt className="w-36 shrink-0 font-semibold text-[var(--ink)] sm:w-40">
                  {title}
                </dt>
                <dd className="text-sm text-[var(--muted)]">{body}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <SiteFooter />
    </Shell>
  );
}
