import { evaluateLocalStrict } from "./localScore";
import { getRubric } from "./rubrics";
import type { EvaluationRequest, EvaluationResult, ScoreDimension } from "./types";

/**
 * Open-source / self-hosted evaluation pipeline (no Gemini).
 *
 * Priority:
 * 1. EVALUATOR_URL — your trained OpenAI-compatible chat model
 * 2. Ollama at OLLAMA_BASE_URL (default http://127.0.0.1:11434)
 * 3. Strict local evidence grader (always works, low RAM)
 *
 * For IEETS essay AES models / SpeechLLM checkpoints, expose them behind
 * EVALUATOR_URL as a chat/completions-compatible endpoint.
 */

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response");
  return JSON.parse(raw.slice(start, end + 1));
}

function buildPrompt(req: EvaluationRequest): string {
  const rubric = getRubric(req);
  return `You are a harsh competitive-exam examiner (UPSC / IELTS / debate / interview standards or tougher).
No participation marks. Empty or unserious answers get near-zero.
Typical good attempt: 45-65. Above 75 is rare and must be justified from TEXT ONLY.

RUBRIC: ${rubric.title}
STANDARD: ${rubric.standard}
DIMENSIONS:
${rubric.dimensions.map((d) => `- ${d.id} (${d.label}, weight ${d.weight}): ${d.toughGuide}`).join("\n")}

CONTEXT:
kind=${req.kind}; mode=${req.mode}; exam=${req.examName ?? req.examId ?? "open"};
difficulty=${req.difficulty}; field=${req.category};
topic=${req.topic};
time_used_s=${req.durationSec}; target_s=${req.targetSec};
words=${req.transcriptOrEssay.trim().split(/\s+/).filter(Boolean).length}

SUBMITTED TEXT:
"""
${req.transcriptOrEssay.slice(0, 14000)}
"""

Return ONLY JSON:
{
  "overall": "2-4 sentence verdict",
  "band": "short band label",
  "overallScore": 0-100,
  "scores": [
    { "id": "content|structure|clarity|presence|time", "value": 0-100, "note": "evidence-based" }
  ],
  "tips": ["..."],
  "strengths": ["..."],
  "weaknesses": ["..."],
  "nextDrill": "...",
  "insufficientEvidence": true
}`;
}

async function chatComplete(baseUrl: string, model: string, prompt: string): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.EVALUATOR_API_KEY
        ? { Authorization: `Bearer ${process.env.EVALUATOR_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You grade competitive speaking/essays strictly. Output JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Evaluator HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content || "";
}

async function ollamaGenerate(baseUrl: string, model: string, prompt: string): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0.2 },
      messages: [
        {
          role: "system",
          content:
            "You grade competitive speaking/essays strictly. Output JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content || "";
}

function parseModelJson(
  text: string,
  req: EvaluationRequest,
  local: EvaluationResult,
  source: EvaluationResult["source"],
): EvaluationResult {
  const rubric = getRubric(req);
  const parsed = extractJson(text) as {
    overall: string;
    band: string;
    overallScore: number;
    scores: { id: string; value: number; note: string }[];
    tips: string[];
    strengths: string[];
    weaknesses: string[];
    nextDrill: string;
    insufficientEvidence?: boolean;
  };

  const byId = new Map(parsed.scores?.map((s) => [s.id, s]) ?? []);
  const scores: ScoreDimension[] = rubric.dimensions.map((d) => {
    const hit = byId.get(d.id);
    return {
      label: d.label,
      weight: d.weight,
      value: Math.max(0, Math.min(100, Math.round(Number(hit?.value ?? 0)))),
      note: hit?.note || d.toughGuide,
    };
  });

  let overallScore = Math.max(
    0,
    Math.min(100, Math.round(Number(parsed.overallScore ?? 0))),
  );

  if (local.insufficientEvidence) {
    overallScore = Math.min(overallScore, Math.max(local.overallScore, 18));
    for (const s of scores) s.value = Math.min(s.value, 22);
  }
  if (local.wordCount < 30 && req.kind === "speech") {
    overallScore = Math.min(overallScore, 15);
    for (const s of scores) s.value = Math.min(s.value, 18);
  }
  if (local.wordCount < 120 && req.kind === "essay") {
    overallScore = Math.min(overallScore, 25);
    for (const s of scores) s.value = Math.min(s.value, 28);
  }

  return {
    evaluated: true,
    source,
    insufficientEvidence:
      Boolean(parsed.insufficientEvidence) || local.insufficientEvidence,
    overall: parsed.overall || local.overall,
    band: parsed.band || local.band,
    overallScore,
    scores,
    tips: (parsed.tips || local.tips).slice(0, 6),
    strengths: parsed.strengths || [],
    weaknesses: parsed.weaknesses || local.weaknesses,
    nextDrill: parsed.nextDrill || local.nextDrill,
    transcriptUsed: req.transcriptOrEssay.slice(0, 8000),
    wordCount: local.wordCount,
    durationSec: req.durationSec,
    targetSec: req.targetSec,
  };
}

export async function evaluateOpenSource(
  req: EvaluationRequest,
): Promise<EvaluationResult> {
  const local = evaluateLocalStrict(req);
  if (local.insufficientEvidence && local.wordCount < 8) {
    return local;
  }

  const prompt = buildPrompt(req);
  const customUrl = process.env.EVALUATOR_URL?.trim();
  const customModel = process.env.EVALUATOR_MODEL?.trim() || "speakeasy-examiner";
  const ollamaUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const ollamaModel = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b";

  // 1) User's trained / hosted model (OpenAI-compatible)
  if (customUrl) {
    try {
      const content = await chatComplete(customUrl, customModel, prompt);
      return parseModelJson(content, req, local, "custom-model");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "custom model failed";
      // fall through
      console.warn("EVALUATOR_URL failed:", msg);
    }
  }

  // 2) Local Ollama (optional; works without 8GB if using small models e.g. 1.5B–3B)
  try {
    const ping = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(1200),
    }).catch(() => null);
    if (ping?.ok) {
      const content = await ollamaGenerate(ollamaUrl, ollamaModel, prompt);
      return parseModelJson(content, req, local, "ollama");
    }
  } catch (e) {
    console.warn("Ollama unavailable:", e);
  }

  // 3) Always-available strict local grader (low RAM)
  return {
    ...local,
    overall: local.overall,
  };
}
