import { NextResponse } from "next/server";
import { evaluateOpenSource } from "@/lib/evaluation/openSource";
import type { EvaluationRequest } from "@/lib/evaluation/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EvaluationRequest;
    if (!body || typeof body.topic !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const result = await evaluateOpenSource({
      kind: body.kind === "essay" ? "essay" : "speech",
      topic: body.topic,
      mode: body.mode || "impromptu",
      examId: body.examId ?? null,
      examName: body.examName ?? null,
      difficulty: body.difficulty || "standard",
      category: body.category || "all",
      transcriptOrEssay: body.transcriptOrEssay || "",
      durationSec: Number(body.durationSec) || 0,
      targetSec: Number(body.targetSec) || 60,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Evaluation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
