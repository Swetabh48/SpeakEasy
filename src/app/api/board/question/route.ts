import { NextResponse } from "next/server";
import { nextBoardQuestion } from "@/lib/boardAgent/orchestrate";
import type { BoardMemory } from "@/lib/boardAgent/memory";
import { emptyBoardMemory } from "@/lib/boardAgent/memory";
import type { AgentTurn } from "@/lib/boardAgent/personas";
import { getSession, saveSession, upsertSession } from "@/lib/boardAgent/store";
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
    let rec = getSession(body.sessionId);

    if (rec) {
      profile = profile || rec.profile;
      if ((body.turns?.length || 0) >= rec.turns.length) {
        turns = body.turns || rec.turns;
      } else {
        turns = rec.turns;
      }
      memory = memory || rec.memory || emptyBoardMemory();
    }

    // Different Vercel isolate than /session — rebuild from client state.
    if (!rec && profile?.name?.trim()) {
      rec = upsertSession(
        body.sessionId,
        profile,
        turns,
        memory || emptyBoardMemory(),
      );
    } else if (rec && profile) {
      rec = upsertSession(body.sessionId, profile, turns, memory || rec.memory);
    }

    if (!profile?.name?.trim()) {
      // Never 404 mid-room — return a chair welcome so the UI can continue.
      return NextResponse.json({
        turnId: crypto.randomUUID(),
        question:
          "Good morning. Please make yourself comfortable, and introduce yourself briefly — education, hometown, and why you are before this board today.",
        speakerId: "chair",
        speakerName: "Dr. Mehta",
        category: "welcome",
        isFollowUp: false,
        move: "new_topic",
        llmSource: "bank",
        memory: emptyBoardMemory(),
        trace: null,
      });
    }

    const result = await nextBoardQuestion(
      profile,
      turns,
      memory || emptyBoardMemory(),
    );
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
    } else {
      upsertSession(body.sessionId, profile, [...turns, boardTurn], result.memory);
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
      {
        turnId: crypto.randomUUID(),
        question:
          "Good morning. Please introduce yourself in about two minutes — your education, hometown, and what brings you to this board.",
        speakerId: "chair",
        speakerName: "Dr. Mehta",
        category: "welcome",
        isFollowUp: false,
        move: "new_topic",
        llmSource: "bank",
        memory: emptyBoardMemory(),
        trace: null,
        warning: e instanceof Error ? e.message : "question failed",
      },
      { status: 200 },
    );
  }
}
