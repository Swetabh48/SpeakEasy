import type { BoardMemory } from "@/lib/boardAgent/memory";
import { emptyBoardMemory } from "@/lib/boardAgent/memory";
import type { AgentTurn } from "@/lib/boardAgent/personas";
import type { CandidateProfile } from "@/lib/topics/board";

export type BoardSessionRecord = {
  sessionId: string;
  profileId: string;
  profile: CandidateProfile;
  turns: AgentTurn[];
  memory: BoardMemory;
  startedAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __speakeasyBoardSessions: Map<string, BoardSessionRecord> | undefined;
}

function store(): Map<string, BoardSessionRecord> {
  if (!globalThis.__speakeasyBoardSessions) {
    globalThis.__speakeasyBoardSessions = new Map();
  }
  return globalThis.__speakeasyBoardSessions;
}

export function createSession(profile: CandidateProfile): BoardSessionRecord {
  const sessionId = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const rec: BoardSessionRecord = {
    sessionId,
    profileId,
    profile,
    turns: [],
    memory: emptyBoardMemory(),
    startedAt: new Date().toISOString(),
  };
  store().set(sessionId, rec);
  return rec;
}

export function getSession(sessionId: string): BoardSessionRecord | undefined {
  return store().get(sessionId);
}

export function saveSession(rec: BoardSessionRecord): void {
  if (!rec.memory) rec.memory = emptyBoardMemory();
  store().set(rec.sessionId, rec);
}
