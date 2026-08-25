import type { CandidateProfile } from "@/lib/topics/board";

const KEY = "speakeasy:daf-profile-v1";

export function loadSavedDaf(): CandidateProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CandidateProfile;
  } catch {
    return null;
  }
}

export function saveDaf(profile: CandidateProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(profile));
}

export function clearSavedDaf(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
