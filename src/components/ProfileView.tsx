"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandMark, MetaChip, Panel, Shell } from "@/components/Shell";
import { buildProfile, loadEvals, type StoredEval } from "@/lib/profile";
import { modeLabel } from "@/lib/topics/engine";

export function ProfileView() {
  const [evals, setEvals] = useState<StoredEval[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEvals(loadEvals());
    setHydrated(true);
  }, []);

  const profile = useMemo(() => buildProfile(evals), [evals]);
  const scored = useMemo(
    () => evals.filter((e) => !e.insufficientEvidence).slice(0, 24).reverse(),
    [evals],
  );
  const modeBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const e of scored) {
      const cur = map.get(e.mode) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += e.overallScore;
      map.set(e.mode, cur);
    }
    return [...map.entries()]
      .map(([mode, v]) => ({
        mode,
        count: v.count,
        avg: Math.round(v.total / v.count),
      }))
      .sort((a, b) => b.count - a.count);
  }, [scored]);

  const dimEntries = Object.entries(profile.dimensionAverages).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <Shell>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="rounded-2xl transition hover:opacity-90">
          <BrandMark />
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 cursor-pointer items-center rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 text-sm transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)]"
        >
          ← Back to practice
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 sm:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Your growth
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Profile
          </h1>
          <p className="mt-3 text-[var(--muted)]">
            Scores and trends from sessions scored on this device. Empty or
            incomplete attempts stay out of the averages.
          </p>
        </div>

        {!hydrated ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <div className="grid gap-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Scored sessions" value={`${profile.scoredSessions}`} />
              <Stat label="Avg score" value={`${profile.averageScore}`} />
              <Stat label="Best" value={`${profile.bestScore}`} />
              <Stat label="All attempts" value={`${profile.sessions}`} />
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              <Panel className="p-5 sm:p-6 lg:col-span-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                  Score trajectory
                </p>
                <p className="mt-1 font-display text-xl">Recent scored sessions</p>
                {scored.length === 0 ? (
                  <p className="mt-8 text-sm text-[var(--muted)]">
                    Complete a scored speaking or essay session to see your
                    chart.
                  </p>
                ) : (
                  <ScoreLineChart points={scored.map((e) => e.overallScore)} />
                )}
              </Panel>

              <Panel className="p-5 sm:p-6 lg:col-span-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                  By mode
                </p>
                <p className="mt-1 font-display text-xl">Where you practice</p>
                {modeBreakdown.length === 0 ? (
                  <p className="mt-8 text-sm text-[var(--muted)]">No mode data yet.</p>
                ) : (
                  <ModeBars rows={modeBreakdown} />
                )}
              </Panel>
            </div>

            <Panel className="p-5 sm:p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                Rubric averages
              </p>
              <p className="mt-1 font-display text-xl">Dimension strength</p>
              {dimEntries.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--muted)]">No dimension data yet.</p>
              ) : (
                <DimensionBars rows={dimEntries} />
              )}
            </Panel>

            <div className="grid gap-6 md:grid-cols-2">
              <Panel className="p-5 sm:p-6">
                <p className="font-display text-xl">Improve next</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.topWeaknesses.length === 0 && (
                    <p className="text-sm text-[var(--muted)]">
                      Complete scored sessions to unlock patterns.
                    </p>
                  )}
                  {profile.topWeaknesses.map((w) => (
                    <MetaChip key={w}>{w}</MetaChip>
                  ))}
                </div>
              </Panel>
              <Panel className="p-5 sm:p-6">
                <p className="font-display text-xl">Strengths</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.topStrengths.length === 0 && (
                    <p className="text-sm text-[var(--muted)]">No scored strengths yet.</p>
                  )}
                  {profile.topStrengths.map((w) => (
                    <MetaChip key={w}>{w}</MetaChip>
                  ))}
                </div>
              </Panel>
            </div>

            <section>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                Recent evaluations
              </p>
              <div className="grid gap-3">
                {evals.length === 0 && (
                  <Panel className="p-5 text-sm text-[var(--muted)]">
                    No evaluations saved yet. Score a session from home to start
                    building this history.
                  </Panel>
                )}
                {evals.slice(0, 30).map((e) => (
                  <div
                    key={e.id}
                    className="rounded-[22px] border border-[var(--line)] bg-[var(--panel)]/80 p-4 backdrop-blur-xl"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <MetaChip>{e.kind}</MetaChip>
                        <MetaChip>{safeModeLabel(e.mode)}</MetaChip>
                        {e.examName && <MetaChip>{e.examName}</MetaChip>}
                      </div>
                      <span className="font-mono text-lg text-[var(--accent)]">
                        {e.overallScore}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-snug">{e.topic}</p>
                    <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                      {formatWhen(e.at)} · {e.band}
                      {e.insufficientEvidence ? " · incomplete attempt" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl">{value}</p>
    </Panel>
  );
}

function ScoreLineChart({ points }: { points: number[] }) {
  const w = 560;
  const h = 200;
  const padX = 16;
  const padY = 20;
  const max = 100;
  const min = 0;

  const coords = points.map((v, i) => {
    const x =
      points.length === 1
        ? w / 2
        : padX + (i / (points.length - 1)) * (w - padX * 2);
    const y = padY + (1 - (v - min) / (max - min)) * (h - padY * 2);
    return { x, y, v };
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const area =
    coords.length > 0
      ? `${line} L ${coords[coords.length - 1]!.x} ${h - padY} L ${coords[0]!.x} ${h - padY} Z`
      : "";

  return (
    <div className="mt-4">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-48 w-full overflow-visible"
        role="img"
        aria-label="Score trajectory chart"
      >
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padY + (1 - tick / 100) * (h - padY * 2);
          return (
            <g key={tick}>
              <line
                x1={padX}
                x2={w - padX}
                y1={y}
                y2={y}
                stroke="rgba(243,239,230,0.08)"
                strokeWidth="1"
              />
              <text
                x={0}
                y={y + 3}
                fill="rgba(154,163,178,0.9)"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {tick}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#scoreFill)" opacity="0.55" />
        <path
          d={line}
          fill="none"
          stroke="url(#scoreStroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="4.5" fill="#E8A849" />
            <title>{c.v}</title>
          </g>
        ))}
        <defs>
          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#E8A849" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="scoreStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E8A849" />
            <stop offset="100%" stopColor="#5EEAD4" />
          </linearGradient>
        </defs>
      </svg>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
        Oldest → newest · {points.length} point{points.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function DimensionBars({ rows }: { rows: [string, number][] }) {
  return (
    <ul className="mt-5 space-y-3">
      {rows.map(([label, value]) => (
        <li key={label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--muted)]">{label}</span>
            <span className="font-mono text-[var(--accent)]">{value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--teal)]"
              style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ModeBars({
  rows,
}: {
  rows: { mode: string; count: number; avg: number }[];
}) {
  const maxCount = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="mt-5 space-y-4">
      {rows.map((r) => (
        <li key={r.mode}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span>{safeModeLabel(r.mode)}</span>
            <span className="font-mono text-[10px] text-[var(--muted)]">
              {r.count} · avg {r.avg}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full bg-[var(--teal)]/80"
              style={{ width: `${(r.count / maxCount) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function safeModeLabel(mode: string) {
  const label = modeLabel(mode as Parameters<typeof modeLabel>[0]);
  return label || mode;
}

function formatWhen(at: number) {
  try {
    return new Date(at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
