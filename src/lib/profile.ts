import type { EvaluationResult, ProfileSnapshot } from "./evaluation/types";

const PROFILE_KEY = "speakeasy:profile-evals";

export type StoredEval = {
  id: string;
  at: number;
  topic: string;
  mode: string;
  examName: string | null;
  kind: "speech" | "essay";
  overallScore: number;
  band: string;
  weaknesses: string[];
  strengths: string[];
  dimensionScores: { label: string; value: number }[];
  insufficientEvidence: boolean;
  source: string;
};

export function loadEvals(): StoredEval[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "[]") as StoredEval[];
  } catch {
    return [];
  }
}

export function pushEval(entry: StoredEval): StoredEval[] {
  const next = [entry, ...loadEvals()].slice(0, 200);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}

export function saveEvalFromResult(
  meta: {
    topic: string;
    mode: string;
    examName: string | null;
    kind: "speech" | "essay";
  },
  result: EvaluationResult,
): StoredEval[] {
  return pushEval({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    topic: meta.topic,
    mode: meta.mode,
    examName: meta.examName,
    kind: meta.kind,
    overallScore: result.overallScore,
    band: result.band,
    weaknesses: result.weaknesses,
    strengths: result.strengths,
    dimensionScores: result.scores.map((s) => ({
      label: s.label,
      value: s.value,
    })),
    insufficientEvidence: result.insufficientEvidence,
    source: result.source,
  });
}

export function buildProfile(evals: StoredEval[]): ProfileSnapshot {
  const scored = evals.filter((e) => !e.insufficientEvidence);
  const recentScores = scored.slice(0, 12).map((e) => e.overallScore).reverse();
  const dimensionAverages: Record<string, number[]> = {};
  for (const e of scored) {
    for (const d of e.dimensionScores) {
      (dimensionAverages[d.label] ??= []).push(d.value);
    }
  }
  const dimAvg: Record<string, number> = {};
  for (const [k, arr] of Object.entries(dimensionAverages)) {
    dimAvg[k] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  const weakCount = new Map<string, number>();
  const strongCount = new Map<string, number>();
  for (const e of scored) {
    for (const w of e.weaknesses) weakCount.set(w, (weakCount.get(w) ?? 0) + 1);
    for (const s of e.strengths) strongCount.set(s, (strongCount.get(s) ?? 0) + 1);
  }

  const topWeaknesses = [...weakCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
  const topStrengths = [...strongCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  const averageScore = scored.length
    ? Math.round(scored.reduce((s, e) => s + e.overallScore, 0) / scored.length)
    : 0;
  const bestScore = scored.length
    ? Math.max(...scored.map((e) => e.overallScore))
    : 0;

  return {
    sessions: evals.length,
    scoredSessions: scored.length,
    averageScore,
    bestScore,
    recentScores,
    dimensionAverages: dimAvg,
    topWeaknesses,
    topStrengths,
    lastUpdated: Date.now(),
  };
}
