import type { Topic } from "./topics/engine";
import { topicFingerprint } from "./topics/fingerprint";

const SEEN_KEY = "speakeasy:seen-topics";
const SEEN_KEY_LEGACY = "speakeasy:seen-ids";
const HISTORY_KEY = "speakeasy:history";
const STREAK_KEY = "speakeasy:streak";
const SETTINGS_KEY = "speakeasy:settings";

const MAX_SEEN = 8000;
const MAX_HISTORY = 80;

export type HistoryItem = {
  id: string;
  text: string;
  mode: string;
  category: string;
  difficulty: string;
  practicedAt: number;
  durationSec: number;
  hadRecording: boolean;
};

export type StreakState = {
  current: number;
  best: number;
  lastPracticeDay: string | null;
};

export type StoredSettings = {
  prepSec: number;
  speakSec: number;
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Load fingerprints of topic text already shown on this device. */
export function loadSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  const current = safeParse<string[]>(localStorage.getItem(SEEN_KEY), []);
  const legacy = safeParse<string[]>(localStorage.getItem(SEEN_KEY_LEGACY), []);
  const history = safeParse<HistoryItem[]>(localStorage.getItem(HISTORY_KEY), []);
  const seen = new Set<string>();

  for (const key of [...current, ...legacy]) {
    if (key.startsWith("fp:")) seen.add(key);
  }
  for (const item of history) {
    if (item.text?.trim()) seen.add(topicFingerprint(item.text));
  }

  return seen;
}

export function persistSeenIds(seen: Set<string>) {
  const arr = [...seen].filter((k) => k.startsWith("fp:"));
  const trimmed = arr.length > MAX_SEEN ? arr.slice(arr.length - MAX_SEEN) : arr;
  localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
}

export function markTopicSeen(topic: Topic, seen: Set<string>): Set<string> {
  const next = new Set(seen);
  next.add(topicFingerprint(topic.text));
  persistSeenIds(next);
  return next;
}

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  return safeParse<HistoryItem[]>(localStorage.getItem(HISTORY_KEY), []);
}

export function pushHistory(item: HistoryItem): HistoryItem[] {
  const prev = loadHistory();
  const next = [item, ...prev].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function loadStreak(): StreakState {
  if (typeof window === "undefined") {
    return { current: 0, best: 0, lastPracticeDay: null };
  }
  return safeParse<StreakState>(localStorage.getItem(STREAK_KEY), {
    current: 0,
    best: 0,
    lastPracticeDay: null,
  });
}

export function bumpStreak(): StreakState {
  const prev = loadStreak();
  const today = todayKey();
  if (prev.lastPracticeDay === today) return prev;

  let current = 1;
  if (prev.lastPracticeDay === yesterdayKey()) {
    current = prev.current + 1;
  }

  const next: StreakState = {
    current,
    best: Math.max(prev.best, current),
    lastPracticeDay: today,
  };
  localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  return next;
}

export function loadSettings(): StoredSettings {
  if (typeof window === "undefined") return { prepSec: 30, speakSec: 60 };
  return safeParse(localStorage.getItem(SETTINGS_KEY), {
    prepSec: 30,
    speakSec: 60,
  });
}

export function saveSettings(settings: StoredSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function formatSpace(n: number): string {
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)} Cr+`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)} L+`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K+`;
  return `${n}`;
}
