import type {
  CandidateProfile,
  ToolTrace,
  ViolationEvent,
} from "@/lib/topics/board";
import type { BoardTurn } from "@/lib/topics/board";

/**
 * Board API base:
 * - Empty / unset → same-origin Next.js `/api/board/*` (works on Vercel for any PC)
 * - Set NEXT_PUBLIC_BACKEND_URL → external FastAPI (local Ollama orchestrator)
 */
function boardBase(): string {
  const explicit = process.env.NEXT_PUBLIC_BACKEND_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return "";
}

function boardPath(path: string): string {
  const base = boardBase();
  // FastAPI uses /board/... ; Next uses /api/board/...
  if (base) return `${base}${path.startsWith("/board") ? path : `/board${path}`}`;
  const p = path.startsWith("/board") ? path : `/board${path}`;
  return `/api${p}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(boardPath(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { detail?: string; error?: string }).detail ||
        (err as { error?: string }).error ||
        `Backend error ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

export async function createBoardSession(profile: CandidateProfile) {
  return api<{
    sessionId: string;
    profileId: string;
    track: string;
    startedAt: string;
  }>("/board/session", {
    method: "POST",
    body: JSON.stringify({ profile }),
  });
}

export async function fetchBoardQuestion(
  sessionId: string,
  opts?: { profile?: CandidateProfile; turns?: BoardTurn[] },
) {
  return api<{
    turnId: string;
    question: string;
    speakerId?: string | null;
    speakerName?: string | null;
    category?: string | null;
    isFollowUp?: boolean;
    trace: ToolTrace | null;
  }>("/board/question", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      profile: opts?.profile,
      turns: opts?.turns?.map((t) => ({
        role: t.role,
        text: t.text,
        speakerId: t.speakerId,
        speakerName: t.speakerName,
        category: t.category,
        isFollowUp: t.isFollowUp,
      })),
    }),
  });
}

export async function submitBoardAnswer(
  sessionId: string,
  text: string,
  violations: ViolationEvent[] = [],
) {
  return api<{ turnId: string; accepted: boolean }>("/board/answer", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      text,
      violations: violations.map((v) => ({ kind: v.kind, atMs: v.atMs })),
    }),
  });
}

export async function fetchBoardDebrief(
  sessionId: string,
  turns: {
    role: string;
    text: string;
    speakerId?: string;
    speakerName?: string;
    category?: string;
    isFollowUp?: boolean;
  }[],
  violations: ViolationEvent[] = [],
  profile?: CandidateProfile | null,
) {
  return api<{
    candidateName: string;
    questionCount: number;
    answerCount: number;
    categoryCoverage: string[];
    boardReport: {
      title: string;
      summary: string;
      strengths: string[];
      weaknesses: string[];
      notes: string[];
    };
    disciplineReport: {
      title: string;
      eventCount: number;
      notes: string[];
    };
  }>("/board/debrief", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      turns,
      profile: profile || undefined,
      violations: violations.map((v) => ({ kind: v.kind, atMs: v.atMs })),
    }),
  });
}

export async function checkBackendHealth(): Promise<boolean> {
  const base = boardBase();
  try {
    if (!base) {
      const res = await fetch("/api/board/health", { cache: "no-store" });
      return res.ok;
    }
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
