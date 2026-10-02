import { NextResponse } from "next/server";
import type { CandidateProfile } from "@/lib/topics/board";
import type { StreakState, StoredSettings } from "@/lib/storage";
import { requireUser } from "@/lib/supabase/auth";

export type UserStatePayload = {
  seenFingerprints: string[];
  streak: StreakState;
  settings: StoredSettings;
  daf: CandidateProfile | null;
  mergedLocalAt: string | null;
};

const DEFAULT_STREAK: StreakState = {
  current: 0,
  best: 0,
  lastPracticeDay: null,
};

const DEFAULT_SETTINGS: StoredSettings = { prepSec: 30, speakSec: 60 };

function rowToState(row: Record<string, unknown> | null): UserStatePayload {
  if (!row) {
    return {
      seenFingerprints: [],
      streak: DEFAULT_STREAK,
      settings: DEFAULT_SETTINGS,
      daf: null,
      mergedLocalAt: null,
    };
  }
  return {
    seenFingerprints: (row.seen_fingerprints as string[]) ?? [],
    streak: (row.streak as StreakState) ?? DEFAULT_STREAK,
    settings: (row.settings as StoredSettings) ?? DEFAULT_SETTINGS,
    daf: (row.daf as CandidateProfile | null) ?? null,
    mergedLocalAt: row.merged_local_at
      ? String(row.merged_local_at)
      : null,
  };
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.supabase
    .from("user_state")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ state: rowToState(data as Record<string, unknown> | null) });
}

export async function PATCH(request: Request) {
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

  const patch = body as Partial<{
    seenFingerprints: string[];
    streak: StreakState;
    settings: StoredSettings;
    daf: CandidateProfile | null;
  }>;

  const update: Record<string, unknown> = {
    user_id: auth.user.id,
    updated_at: new Date().toISOString(),
  };
  if (patch.seenFingerprints !== undefined) {
    update.seen_fingerprints = patch.seenFingerprints;
  }
  if (patch.streak !== undefined) update.streak = patch.streak;
  if (patch.settings !== undefined) update.settings = patch.settings;
  if (patch.daf !== undefined) update.daf = patch.daf;

  const { data, error } = await auth.supabase
    .from("user_state")
    .upsert(update, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ state: rowToState(data as Record<string, unknown>) });
}
