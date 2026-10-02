import {
  loadSavedDaf,
  saveDaf as saveDafLocal,
} from "@/lib/dafStorage";
import {
  bumpStreak as bumpStreakLocal,
  loadHistory,
  loadSeenIds,
  loadSettings,
  loadStreak,
  persistSeenIds,
  pushHistory as pushHistoryLocal,
  saveSettings as saveSettingsLocal,
  type HistoryItem,
  type StreakState,
  type StoredSettings,
} from "@/lib/storage";
import {
  loadEvals,
  saveEvalFromResult as saveEvalLocal,
  type StoredEval,
} from "@/lib/profile";
import type { EvaluationResult } from "@/lib/evaluation/types";
import type { CandidateProfile } from "@/lib/topics/board";
import {
  createClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const MERGE_FLAG = "speakeasy:merged-local-v1";

async function signedIn(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
}

async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export async function getSessionUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** Load evals: local always; refresh from cloud when signed in. */
export async function loadEvalsSynced(): Promise<StoredEval[]> {
  const local = loadEvals();
  if (!(await signedIn())) return local;

  const res = await api<{ evaluations: StoredEval[] }>("/api/me/evaluations");
  if (!res.ok) return local;

  // Cloud is source of truth when signed in — also cache locally
  const cloud = res.data.evaluations ?? [];
  localStorage.setItem("speakeasy:profile-evals", JSON.stringify(cloud.slice(0, 200)));
  return cloud;
}

export async function saveEvalFromResultSynced(
  meta: {
    topic: string;
    mode: string;
    examName: string | null;
    kind: "speech" | "essay";
  },
  result: EvaluationResult,
): Promise<StoredEval[]> {
  const next = saveEvalLocal(meta, result);
  const newest = next[0];
  if (newest && (await signedIn())) {
    void api("/api/me/evaluations", {
      method: "POST",
      body: JSON.stringify({ evaluation: newest }),
    });
  }
  return next;
}

export async function loadHistorySynced(): Promise<HistoryItem[]> {
  const local = loadHistory();
  if (!(await signedIn())) return local;

  const res = await api<{ history: HistoryItem[] }>("/api/me/history");
  if (!res.ok) return local;

  const cloud = res.data.history ?? [];
  localStorage.setItem("speakeasy:history", JSON.stringify(cloud.slice(0, 80)));
  return cloud;
}

export async function pushHistorySynced(item: HistoryItem): Promise<HistoryItem[]> {
  const next = pushHistoryLocal(item);
  if (await signedIn()) {
    void api("/api/me/history", {
      method: "POST",
      body: JSON.stringify({ item }),
    });
  }
  return next;
}

export async function loadStreakSynced(): Promise<StreakState> {
  const local = loadStreak();
  if (!(await signedIn())) return local;

  const res = await api<{
    state: { streak: StreakState };
  }>("/api/me/state");
  if (!res.ok) return local;

  const streak = res.data.state.streak;
  localStorage.setItem("speakeasy:streak", JSON.stringify(streak));
  return streak;
}

export async function bumpStreakSynced(): Promise<StreakState> {
  const next = bumpStreakLocal();
  if (await signedIn()) {
    void api("/api/me/state", {
      method: "PATCH",
      body: JSON.stringify({ streak: next }),
    });
  }
  return next;
}

export async function loadSettingsSynced(): Promise<StoredSettings> {
  const local = loadSettings();
  if (!(await signedIn())) return local;

  const res = await api<{
    state: { settings: StoredSettings };
  }>("/api/me/state");
  if (!res.ok) return local;

  const settings = res.data.state.settings;
  saveSettingsLocal(settings);
  return settings;
}

export async function saveSettingsSynced(settings: StoredSettings): Promise<void> {
  saveSettingsLocal(settings);
  if (await signedIn()) {
    void api("/api/me/state", {
      method: "PATCH",
      body: JSON.stringify({ settings }),
    });
  }
}

export async function loadSeenSynced(): Promise<Set<string>> {
  const local = loadSeenIds();
  if (!(await signedIn())) return local;

  const res = await api<{
    state: { seenFingerprints: string[] };
  }>("/api/me/state");
  if (!res.ok) return local;

  const merged = new Set(local);
  for (const fp of res.data.state.seenFingerprints ?? []) {
    if (fp.startsWith("fp:")) merged.add(fp);
  }
  persistSeenIds(merged);
  return merged;
}

export async function persistSeenSynced(seen: Set<string>): Promise<void> {
  persistSeenIds(seen);
  if (await signedIn()) {
    void api("/api/me/state", {
      method: "PATCH",
      body: JSON.stringify({ seenFingerprints: [...seen].filter((k) => k.startsWith("fp:")) }),
    });
  }
}

export async function loadDafSynced(): Promise<CandidateProfile | null> {
  const local = loadSavedDaf();
  if (!(await signedIn())) return local;

  const res = await api<{
    state: { daf: CandidateProfile | null };
  }>("/api/me/state");
  if (!res.ok) return local;

  const daf = res.data.state.daf;
  if (daf) saveDafLocal(daf);
  return daf ?? local;
}

export async function saveDafSynced(profile: CandidateProfile): Promise<void> {
  saveDafLocal(profile);
  if (await signedIn()) {
    void api("/api/me/state", {
      method: "PATCH",
      body: JSON.stringify({ daf: profile }),
    });
  }
}

/**
 * One-time merge of guest localStorage into the signed-in cloud account.
 * Dedupes by id / fingerprint on the server.
 */
export async function mergeLocalAfterLogin(): Promise<void> {
  if (!(await signedIn())) return;
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MERGE_FLAG) === "1") return;

  const evaluations = loadEvals();
  const history = loadHistory();
  const seenFingerprints = [...loadSeenIds()].filter((k) => k.startsWith("fp:"));
  const streak = loadStreak();
  const settings = loadSettings();
  const daf = loadSavedDaf();

  const res = await api<{ ok: boolean }>("/api/me/merge-local", {
    method: "POST",
    body: JSON.stringify({
      evaluations,
      history,
      seenFingerprints,
      streak,
      settings,
      daf,
    }),
  });

  if (res.ok) {
    localStorage.setItem(MERGE_FLAG, "1");
    // Pull cloud back into local cache
    await loadEvalsSynced();
    await loadHistorySynced();
    await loadStreakSynced();
    await loadSettingsSynced();
    await loadSeenSynced();
    await loadDafSynced();
  }
}

export async function clearMergeFlag(): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MERGE_FLAG);
}

export type { StoredEval, HistoryItem, StreakState, StoredSettings };
