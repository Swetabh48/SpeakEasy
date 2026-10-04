import { NextResponse } from "next/server";
import type { HistoryItem } from "@/lib/storage";
import { requireUser } from "@/lib/supabase/auth";

function rowToHistory(row: Record<string, unknown>): HistoryItem {
  return {
    id: String(row.id),
    text: String(row.text),
    mode: String(row.mode),
    category: String(row.category),
    difficulty: String(row.difficulty),
    practicedAt: Number(row.practiced_at),
    durationSec: Number(row.duration_sec ?? 0),
    hadRecording: Boolean(row.had_recording),
  };
}

function historyToRow(userId: string, h: HistoryItem) {
  return {
    id: h.id,
    user_id: userId,
    text: h.text,
    mode: h.mode,
    category: h.category,
    difficulty: h.difficulty,
    practiced_at: h.practicedAt,
    duration_sec: h.durationSec,
    had_recording: h.hadRecording,
  };
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.supabase
    .from("practice_history")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("practiced_at", { ascending: false })
    .limit(80);

  if (error) {
    const missing =
      /does not exist|relation|schema cache/i.test(error.message) ||
      error.code === "42P01" ||
      error.code === "PGRST205";
    if (missing) return NextResponse.json({ history: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    history: (data ?? []).map((r) => rowToHistory(r as Record<string, unknown>)),
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

  const payload = body as { item?: HistoryItem; history?: HistoryItem[] };
  const list = payload.history
    ? payload.history
    : payload.item
      ? [payload.item]
      : [];

  if (!list.length) {
    return NextResponse.json({ error: "No history provided" }, { status: 400 });
  }

  const rows = list.map((h) => historyToRow(auth.user.id, h));
  const { error } = await auth.supabase.from("practice_history").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
