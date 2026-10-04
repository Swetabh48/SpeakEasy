import { followUpHints, shouldFollowUp } from "@/lib/boardAgent/followup";
import { boardLlmChat, extractJsonObject } from "@/lib/boardAgent/llm";
import {
  type AnswerAnalysis,
  type BoardMemory,
  type BoardMove,
  memoryPromptBlock,
} from "@/lib/boardAgent/memory";
import { isMetaQuestionRequest } from "@/lib/boardIntent";
import type { PanelDomain } from "@/lib/boardPanel";
import type { AgentTurn } from "@/lib/boardAgent/personas";
import type { CandidateProfile } from "@/lib/topics/board";

const MOVES: BoardMove[] = [
  "press",
  "clarify",
  "new_topic",
  "invite_example",
  "bridge_close",
];

const DOMAINS: PanelDomain[] = [
  "chair-daf",
  "subject",
  "affairs-ethics",
  "quiet",
  "skeptic",
];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function snippet(answer: string): string {
  const words = answer.trim().split(/\s+/);
  let s = words.slice(0, 18).join(" ");
  if (words.length > 18) s = `${s.replace(/[,.]$/, "")}…`;
  return s;
}

function heuristicAnalyze(
  answer: string,
  turns: AgentTurn[],
  memory: BoardMemory,
): AnswerAnalysis {
  const hints = followUpHints(answer);
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const n = words.length;
  const softFollow = shouldFollowUp(answer, turns);
  const strongThin =
    hints.includes("answer_was_very_short") ||
    hints.includes("answer_was_hedged") ||
    hints.includes("answer_was_vague");
  let suggestedMove: BoardMove = "new_topic";
  if (strongThin || softFollow) {
    if (hints.includes("answer_was_very_short")) suggestedMove = "invite_example";
    else if (hints.includes("answer_was_hedged") || hints.includes("answer_was_vague"))
      suggestedMove = "clarify";
    else suggestedMove = "press";
  } else if (memory.pressureLevel > 0.75 && turns.filter((t) => t.role === "board").length >= 6) {
    suggestedMove = "bridge_close";
  }

  const specificity = clamp01(
    n < 18 ? 0.15 : n < 40 ? 0.35 : n < 120 ? 0.6 : 0.75,
  );
  const hedging = clamp01(
    hints.includes("answer_was_hedged") ? 0.7 : hints.includes("answer_was_vague") ? 0.55 : 0.2,
  );

  let bestSpeakerDomain: PanelDomain = "chair-daf";
  if (suggestedMove === "press" || suggestedMove === "clarify") {
    const lastBoard = [...turns].reverse().find((t) => t.role === "board");
    const open = memory.openThreads[memory.openThreads.length - 1];
    if (open) {
      const map: Record<string, PanelDomain> = {
        chair: "chair-daf",
        "member-a": "subject",
        "member-b": "affairs-ethics",
        "member-c": "quiet",
        "member-d": "skeptic",
      };
      bestSpeakerDomain = map[open.ownerSpeakerId] || "skeptic";
    } else if (lastBoard?.speakerId === "member-a") bestSpeakerDomain = "subject";
    else if (lastBoard?.speakerId === "member-b") bestSpeakerDomain = "affairs-ethics";
    else if (hedging > 0.5) bestSpeakerDomain = "skeptic";
  }

  const claims =
    n >= 8
      ? [snippet(answer)]
      : [];

  return {
    specificity,
    hedging,
    contradictionRisk: clamp01(hedging * 0.4),
    extractClaims: claims,
    suggestedMove,
    bestSpeakerDomain,
    threadTopic: snippet(answer) || "last answer",
    quoteSnippet: snippet(answer),
    source: "heuristic",
  };
}

function normalizeAnalysis(raw: Record<string, unknown>, fallback: AnswerAnalysis): AnswerAnalysis {
  const move = String(raw.suggestedMove || "") as BoardMove;
  const domain = String(raw.bestSpeakerDomain || "") as PanelDomain;
  const claims = Array.isArray(raw.extractClaims)
    ? raw.extractClaims.map((c) => String(c).trim()).filter(Boolean).slice(0, 6)
    : fallback.extractClaims;
  return {
    specificity: clamp01(Number(raw.specificity ?? fallback.specificity)),
    hedging: clamp01(Number(raw.hedging ?? fallback.hedging)),
    contradictionRisk: clamp01(
      Number(raw.contradictionRisk ?? fallback.contradictionRisk),
    ),
    extractClaims: claims.length ? claims : fallback.extractClaims,
    suggestedMove: MOVES.includes(move) ? move : fallback.suggestedMove,
    bestSpeakerDomain: DOMAINS.includes(domain) ? domain : fallback.bestSpeakerDomain,
    threadTopic: String(raw.threadTopic || fallback.threadTopic).slice(0, 120),
    quoteSnippet: String(raw.quoteSnippet || fallback.quoteSnippet).slice(0, 120),
    source: "llm",
  };
}

export async function analyzeAnswer(
  answer: string,
  profile: CandidateProfile,
  turns: AgentTurn[],
  memory: BoardMemory,
): Promise<AnswerAnalysis> {
  const fallback = heuristicAnalyze(answer, turns, memory);
  const words = answer.trim().split(/\s+/).filter(Boolean).length;

  // Meta / very short answers: never let a weak LLM invent "new_topic".
  if (isMetaQuestionRequest(answer) || words < 14) {
    if (isMetaQuestionRequest(answer)) {
      return {
        ...fallback,
        suggestedMove: "clarify",
        hedging: 0.8,
        specificity: 0.1,
        quoteSnippet: answer.trim().slice(0, 120),
        threadTopic: "candidate asked for clarification",
        source: "heuristic",
      };
    }
    return fallback;
  }

  const system =
    "You analyze a candidate's board-interview answer. " +
    "Return ONLY a JSON object with keys: specificity (0-1), hedging (0-1), " +
    "contradictionRisk (0-1), extractClaims (string[]), suggestedMove " +
    "(press|clarify|new_topic|invite_example|bridge_close), " +
    "bestSpeakerDomain (chair-daf|subject|affairs-ethics|quiet|skeptic), " +
    "threadTopic (short), quoteSnippet (short quote from answer). No markdown. " +
    "If the candidate is confused or asking what a term means, suggestedMove MUST be clarify.";
  const user =
    `PROFILE:\n${JSON.stringify(profile)}\n\n` +
    `BOARD_MEMORY:\n${memoryPromptBlock(memory)}\n\n` +
    `RECENT:\n${JSON.stringify(turns.slice(-8))}\n\n` +
    `LAST_ANSWER:\n${answer}`;

  // Short budget — heuristic is fine if hosted brain is cold/slow.
  const llm = await boardLlmChat(system, user, 0.2, {
    purpose: "analyze",
    timeoutMs: 8_000,
  });
  const parsed = extractJsonObject(llm);
  if (!parsed) return fallback;
  const normalized = normalizeAnalysis(parsed, fallback);
  // Guardrail: short thin answers must not become random new topics
  if (
    words < 40 &&
    (fallback.suggestedMove === "press" ||
      fallback.suggestedMove === "clarify" ||
      fallback.suggestedMove === "invite_example") &&
    normalized.suggestedMove === "new_topic"
  ) {
    return { ...normalized, suggestedMove: fallback.suggestedMove, source: "heuristic" };
  }
  return normalized;
}

export function moveIsFollowUp(move: BoardMove): boolean {
  return move === "press" || move === "clarify" || move === "invite_example";
}
