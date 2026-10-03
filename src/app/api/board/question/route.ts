import { NextResponse } from "next/server";
import { nextBoardQuestion } from "@/lib/boardAgent/orchestrate";
import type { BoardMemory } from "@/lib/boardAgent/memory";
import { emptyBoardMemory } from "@/lib/boardAgent/memory";
import type { AgentTurn } from "@/lib/boardAgent/personas";
import { getSession, saveSession } from "@/lib/boardAgent/store";
import { sentry } from "@/lib/observability/sentry";
import type { CandidateProfile } from "@/lib/topics/board";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      profile?: CandidateProfile;
      turns?: AgentTurn[];
      memory?: BoardMemory;
    };
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    let profile = body.profile;
    let turns = body.turns || [];
    let memory = body.memory;
    const rec = getSession(body.sessionId);
    if (rec) {
      profile = profile || rec.profile;
      if ((body.turns?.length || 0) >= rec.turns.length) {
        turns = body.turns || rec.turns;
      } else {
        turns = rec.turns;
      }
      memory = memory || rec.memory || emptyBoardMemory();
    }
    if (!profile) {
      return NextResponse.json(
        {
          error:
            "Session expired on server — profile required. Re-enter the board.",
        },
        { status: 404 },
      );
    }

    const result = await nextBoardQuestion(profile, turns, memory);
    const boardTurn: AgentTurn = {
      role: "board",
      text: result.question,
      speakerId: result.speakerId,
      speakerName: result.speakerName,
      category: result.category,
      isFollowUp: result.isFollowUp,
    };

    if (rec) {
      rec.turns = [...turns, boardTurn];
      rec.memory = result.memory;
      saveSession(rec);
    }

    return NextResponse.json({
      turnId: crypto.randomUUID(),
      question: result.question,
      speakerId: result.speakerId,
      speakerName: result.speakerName,
      category: result.category,
      isFollowUp: result.isFollowUp,
      move: result.isFollowUp ? "follow_up" : "new_topic",
      llmSource: result.llmSource,
      memory: result.memory,
      trace: null,
    });
  } catch (e) {
    sentry.captureException(e, { route: "/api/board/question" });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "question failed" },
      { status: 500 },
    );
  }
}
