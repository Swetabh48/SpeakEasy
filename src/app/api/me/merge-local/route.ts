import { NextResponse } from "next/server";
import type { StoredEval } from "@/lib/profile";
import type { HistoryItem, StreakState, StoredSettings } from "@/lib/storage";
import type { CandidateProfile } from "@/lib/topics/board";
import { requireUser } from "@/lib/supabase/auth";

type MergeBody = {
  evaluations?: StoredEval[];
  history?: HistoryItem[];
  seenFingerprints?: string[];
  streak?: StreakState;
  settings?: StoredSettings;
  daf?: CandidateProfile | null;
};

function mergeStreak(a: StreakState, b: StreakState): StreakState {
  const best = Math.max(a.best, b.best);
  // Prefer the streak with the more recent practice day; else higher current.
  const aDay = a.lastPracticeDay ?? "";
  const bDay = b.lastPracticeDay ?? "";
  if (aDay > bDay) return { ...a, best: Math.max(a.best, best) };
  if (bDay > aDay) return { ...b, best: Math.max(b.best, best) };
  return {
    current: Math.max(a.current, b.current),
    best,
    lastPracticeDay: a.lastPracticeDay ?? b.lastPracticeDay,
  };
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: MergeBody;
  try {
    body = (await request.json()) as MergeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existingState } = await auth.supabase
    .from("user_state")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  // Already merged once — still accept upserts but skip marking again
  const alreadyMerged = Boolean(existingState?.merged_local_at);

  const evaluations = body.evaluations ?? [];
  if (evaluations.length) {
    const rows = evaluations.map((e) => ({
      id: e.id,
      user_id: auth.user.id,
      at: e.at,
      topic: e.topic,
      mode: e.mode,
      exam_name: e.examName,
      kind: e.kind,
      overall_score: e.overallScore,
      band: e.band,
      weaknesses: e.weaknesses,
      strengths: e.strengths,
      dimension_scores: e.dimensionScores,
      insufficient_evidence: e.insufficientEvidence,
      source: e.source,
    }));
    const { error } = await auth.supabase.from("evaluations").upsert(rows, {
      onConflict: "id",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const history = body.history ?? [];
  if (history.length) {
    const rows = history.map((h) => ({
      id: h.id,
      user_id: auth.user.id,
      text: h.text,
      mode: h.mode,
      category: h.category,
      difficulty: h.difficulty,
      practiced_at: h.practicedAt,
      duration_sec: h.durationSec,
      had_recording: h.hadRecording,
    }));
    const { error } = await auth.supabase.from("practice_history").upsert(rows, {
      onConflict: "id",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const cloudSeen = (existingState?.seen_fingerprints as string[]) ?? [];
  const localSeen = body.seenFingerprints ?? [];
  const seen = [...new Set([...cloudSeen, ...localSeen])].filter((k) =>
    k.startsWith("fp:"),
  );

  const cloudStreak = (existingState?.streak as StreakState) ?? {
    current: 0,
    best: 0,
    lastPracticeDay: null,
  };
  const streak = body.streak
    ? mergeStreak(cloudStreak, body.streak)
    : cloudStreak;

  const settings =
    body.settings ??
    (existingState?.settings as StoredSettings) ?? {
      prepSec: 30,
      speakSec: 60,
    };

  const daf =
    body.daf !== undefined
      ? body.daf
      : ((existingState?.daf as CandidateProfile | null) ?? null);

  const stateRow = {
    user_id: auth.user.id,
    seen_fingerprints: seen.slice(-8000),
    streak,
    settings,
    daf,
    merged_local_at: alreadyMerged
      ? existingState!.merged_local_at
      : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: stateError } = await auth.supabase
    .from("user_state")
    .upsert(stateRow, { onConflict: "user_id" });

  if (stateError) {
    return NextResponse.json({ error: stateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    merged: !alreadyMerged,
    counts: {
      evaluations: evaluations.length,
      history: history.length,
      seen: seen.length,
    },
  });
}
