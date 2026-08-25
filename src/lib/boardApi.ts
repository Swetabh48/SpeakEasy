import type {
  CandidateProfile,
  ToolTrace,
  ViolationEvent,
} from "@/lib/topics/board";

function backendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000"
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${backendUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `Backend error ${res.status}`);
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

export async function fetchBoardQuestion(sessionId: string) {
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
    body: JSON.stringify({ sessionId }),
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
      violations: violations.map((v) => ({ kind: v.kind, atMs: v.atMs })),
    }),
  });
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${backendUrl()}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
