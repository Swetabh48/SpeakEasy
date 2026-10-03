import { NextResponse } from "next/server";
import { buildDebrief } from "@/lib/boardAgent/debrief";
import type { BoardMemory } from "@/lib/boardAgent/memory";
import type { AgentTurn } from "@/lib/boardAgent/personas";
import { getSession } from "@/lib/boardAgent/store";
import type { CandidateProfile } from "@/lib/topics/board";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      turns?: AgentTurn[];
      violations?: { kind?: string; atMs?: number }[];
      profile?: CandidateProfile;
      memory?: BoardMemory;
    };
    const rec = body.sessionId ? getSession(body.sessionId) : undefined;
    const turns = body.turns?.length ? body.turns : rec?.turns || [];
    const profile = body.profile || rec?.profile || null;
    const memory = body.memory || rec?.memory || null;
    const data = buildDebrief(turns, body.violations || [], profile, memory);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "debrief failed" },
      { status: 500 },
    );
  }
}
