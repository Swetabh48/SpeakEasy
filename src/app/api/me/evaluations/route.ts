import { NextResponse } from "next/server";
import type { StoredEval } from "@/lib/profile";
import { requireUser } from "@/lib/supabase/auth";

function rowToEval(row: Record<string, unknown>): StoredEval {
  return {
    id: String(row.id),
    at: Number(row.at),
    topic: String(row.topic),
    mode: String(row.mode),
    examName: (row.exam_name as string | null) ?? null,
    kind: row.kind as "speech" | "essay",
    overallScore: Number(row.overall_score),
    band: String(row.band),
    weaknesses: (row.weaknesses as string[]) ?? [],
    strengths: (row.strengths as string[]) ?? [],
    dimensionScores: (row.dimension_scores as { label: string; value: number }[]) ?? [],
    insufficientEvidence: Boolean(row.insufficient_evidence),
    source: String(row.source ?? ""),
  };
}

function evalToRow(userId: string, e: StoredEval) {
  return {
    id: e.id,
    user_id: userId,
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
  };
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.supabase
    .from("evaluations")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("at", { ascending: false })
    .limit(200);

  if (error) {
    const missing =
      /does not exist|relation|schema cache/i.test(error.message) ||
      error.code === "42P01" ||
      error.code === "PGRST205";
    if (missing) return NextResponse.json({ evaluations: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    evaluations: (data ?? []).map((r) => rowToEval(r as Record<string, unknown>)),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as { evaluation?: StoredEval; evaluations?: StoredEval[] };
  const list = payload.evaluations
    ? payload.evaluations
    : payload.evaluation
      ? [payload.evaluation]
      : [];

  if (!list.length) {
    return NextResponse.json({ error: "No evaluations provided" }, { status: 400 });
  }

  const rows = list.map((e) => evalToRow(auth.user.id, e));
  const { error } = await auth.supabase.from("evaluations").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
