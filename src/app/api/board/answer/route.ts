import { NextResponse } from "next/server";
import type { AgentTurn } from "@/lib/boardAgent/personas";
import { getSession, saveSession } from "@/lib/boardAgent/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      text?: string;
      violations?: unknown[];
    };
    const text = (body.text || "").trim();
    if (!body.sessionId || !text) {
      return NextResponse.json({ error: "sessionId and text required" }, { status: 400 });
    }
    const rec = getSession(body.sessionId);
    if (rec) {
      const turn: AgentTurn = { role: "candidate", text };
      rec.turns = [...rec.turns, turn];
      saveSession(rec);
    }
    return NextResponse.json({
      turnId: crypto.randomUUID(),
      accepted: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "answer failed" },
      { status: 500 },
    );
  }
}
