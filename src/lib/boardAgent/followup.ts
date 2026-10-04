import type { AgentTurn } from "@/lib/boardAgent/personas";
import { hashRatio } from "@/lib/boardAgent/personas";

const HEDGE_RE =
  /\b(i think|i feel|maybe|perhaps|sort of|kind of|basically|actually|you know|i mean|probably|possibly|somewhat|more or less|etc\.?|and so on|various things|many things|as such|in a way|not sure)\b/gi;
const VAGUE_RE =
  /\b(holistic|synergy|leverage|going forward|at the end of the day|overall|in general|whatever|stuff|things like that)\b/gi;

export function shouldFollowUp(answer: string, priorTurns: AgentTurn[]): boolean {
  const text = (answer || "").trim();
  if (!text) return false;

  const words = text.split(/\s+/).filter(Boolean);
  const n = words.length;
  // Very short / confused lines always get pressed — no coin-flip skip.
  if (n < 14) return true;

  const boardN = priorTurns.filter((t) => t.role === "board").length;
  if (boardN === 0) {
    return n < 45 && hashRatio(text + "|intro") < 0.55;
  }

  const hedges = (text.match(HEDGE_RE) || []).length;
  const vague = (text.match(VAGUE_RE) || []).length;

  let score = 0.18;
  if (n < 40) score += 0.18;
  if (n < 18) score += 0.22;
  if (n > 220) score += 0.12;
  if (hedges >= 2) score += 0.16;
  if (hedges >= 4) score += 0.12;
  if (vague >= 1) score += 0.12;

  const priorBoard = priorTurns
    .filter((t) => t.role === "board")
    .map((t) => t.text)
    .join(" ")
    .toLowerCase();
  let dafHits = 0;
  for (const token of ["optional", "hobby", "state", "village", "degree", "work", "job"]) {
    if (text.toLowerCase().includes(token) && priorBoard.includes(token)) dafHits += 1;
  }
  if (dafHits) score += 0.1 * Math.min(dafHits, 3);

  const p = Math.min(0.72, Math.max(0.28, score));
  return hashRatio(text.slice(0, 240) + `|fu|${boardN}`) < p;
}

export function followUpHints(answer: string): string[] {
  const hints: string[] = [];
  const words = answer.split(/\s+/);
  if (words.length < 20) hints.push("answer_was_very_short");
  if ((answer.match(HEDGE_RE) || []).length >= 2) hints.push("answer_was_hedged");
  if ((answer.match(VAGUE_RE) || []).length >= 1) hints.push("answer_was_vague");
  if (words.length > 200) hints.push("answer_was_long_ask_one_point");
  return hints.length ? hints : ["press_for_specificity"];
}
