import { analyzeAnswer, moveIsFollowUp } from "@/lib/boardAgent/analyze";
import { fallbackFollowUp, fallbackQuestion } from "@/lib/boardAgent/generate";
import { boardLlmChat, getLastBoardLlmMeta } from "@/lib/boardAgent/llm";
import {
  applyAnalysisToMemory,
  emptyBoardMemory,
  memoryPromptBlock,
  type BoardMemory,
} from "@/lib/boardAgent/memory";
import {
  inferCategory,
  personaSystem,
  pickPersona,
  type AgentTurn,
} from "@/lib/boardAgent/personas";
import {
  corpusFallbackQuestion,
  stylePromptBlock,
} from "@/lib/boardAgent/styleCorpus";
import { clarifyQuestionText, isMetaQuestionRequest } from "@/lib/boardIntent";
import type { PanelMemberId } from "@/lib/boardPanel";
import type { CandidateProfile } from "@/lib/topics/board";

/** Reject obvious SmolLM / cold-model garbage so mock-doc banks take over. */
function isLowQualityQuestion(
  question: string,
  profile: CandidateProfile,
  lastBoard?: string | null,
  requireFollowUp = false,
): boolean {
  const q = question.trim();
  if (q.length < 24) return true;
  const lower = q.toLowerCase();
  const first = (profile.name || "").trim().split(/\s+/)[0] || "";
  // Invented candidate name at start ("Mona, welcome…")
  const lead = q.match(/^([A-Z][a-z]{2,}),/);
  if (lead && first && lead[1].toLowerCase() !== first.toLowerCase()) return true;
  // Known hallucination styles from the tiny LoRA host
  if (/\b(hana culture|henna culture)\b/i.test(q) && !lower.includes("rajasthan") && !lower.includes("mehndi")) {
    /* allow if grounded; still often junk — fall through */
  }
  if (/\bdon'?t rush the meeting\b/i.test(q)) return true;
  if (requireFollowUp && lastBoard) {
    const boardTok = new Set(
      (lastBoard.toLowerCase().match(/[a-z]{4,}/g) || []).slice(0, 24),
    );
    const qTok = lower.match(/[a-z]{4,}/g) || [];
    const overlap = qTok.filter((w) => boardTok.has(w)).length;
    // Completely new policy essay with zero overlap = topic hop
    if (overlap === 0 && /\b(budget|education system|gdp|inflation)\b/i.test(q)) {
      return true;
    }
  }
  return false;
}

export type NextQuestionResult = {
  question: string;
  speakerId: string;
  speakerName: string;
  category: string;
  isFollowUp: boolean;
  memory: BoardMemory;
  llmSource: "evaluator" | "ollama" | "corpus" | "bank";
};

function emergencyQuestion(
  profile: CandidateProfile,
  turns: AgentTurn[],
  memory: BoardMemory,
): NextQuestionResult {
  const boardN = turns.filter((t) => t.role === "board").length;
  const category = inferCategory(profile, boardN, false, undefined, memory);
  const persona = pickPersona(profile, turns, category, false, null, memory);
  const lastAnswer = [...turns].reverse().find((t) => t.role === "candidate");
  const fromCorpus = corpusFallbackQuestion(
    `${profile.name}|${category}|${boardN}|emergency|${persona.id}`,
    lastAnswer?.text,
    Boolean(lastAnswer),
  );
  const question =
    fromCorpus ||
    (lastAnswer
      ? fallbackFollowUp(profile, persona, lastAnswer.text)
      : fallbackQuestion(profile, turns, persona, category));
  return {
    question,
    speakerId: persona.id,
    speakerName: persona.name,
    category,
    isFollowUp: Boolean(lastAnswer && fromCorpus),
    memory,
    llmSource: fromCorpus ? "corpus" : "bank",
  };
}

export async function nextBoardQuestion(
  profile: CandidateProfile,
  turns: AgentTurn[],
  priorMemory?: BoardMemory | null,
): Promise<NextQuestionResult> {
  const memorySeed = priorMemory
    ? {
        ...priorMemory,
        dafCoverage: { ...priorMemory.dafCoverage },
        memberNotes: { ...priorMemory.memberNotes },
        claims: [...priorMemory.claims],
        openThreads: [...priorMemory.openThreads],
      }
    : emptyBoardMemory();

  try {
    return await nextBoardQuestionInner(profile, turns, memorySeed);
  } catch {
    return emergencyQuestion(profile, turns, memorySeed);
  }
}

async function nextBoardQuestionInner(
  profile: CandidateProfile,
  turns: AgentTurn[],
  memoryIn: BoardMemory,
): Promise<NextQuestionResult> {
  let memory = memoryIn;

  const lastAnswer = [...turns].reverse().find((t) => t.role === "candidate");
  const boardN = turns.filter((t) => t.role === "board").length;

  let analysis = null;
  if (lastAnswer) {
    analysis = await analyzeAnswer(lastAnswer.text, profile, turns, memory);
  }

  const isFollowUp = Boolean(analysis && moveIsFollowUp(analysis.suggestedMove));
  const category = inferCategory(
    profile,
    boardN,
    isFollowUp,
    analysis?.suggestedMove,
    memory,
  );
  const persona = pickPersona(
    profile,
    turns,
    category,
    isFollowUp,
    analysis,
    memory,
  );

  const prior = turns.filter((t) => t.role === "board").map((t) => t.text);
  let question = "";
  let fallbackKind: "corpus" | "bank" | null = null;

  const styleBlock = stylePromptBlock(
    `${category} ${persona.domain} ${profile.homeState} ${profile.optionalSubject || ""}`,
    lastAnswer?.text,
  );

  const lastBoardText =
    [...turns].reverse().find((t) => t.role === "board")?.text || "";

  // Candidate asked "what even is X?" — hold the same board question (server-side too).
  if (lastAnswer && isMetaQuestionRequest(lastAnswer.text) && lastBoardText) {
    question = clarifyQuestionText(lastBoardText);
    fallbackKind = "bank";
    if (analysis) {
      memory = applyAnalysisToMemory(
        memory,
        { ...analysis, suggestedMove: "clarify" },
        persona.id as PanelMemberId,
        category,
      );
    }
    return {
      question,
      speakerId: persona.id,
      speakerName: persona.name,
      category,
      isFollowUp: true,
      memory,
      llmSource: "bank",
    };
  }

  if (isFollowUp && lastAnswer && analysis) {
    const system =
      personaSystem(persona, memory) +
      "\n\nCROSS-QUESTION the last answer. Quote or paraphrase one concrete claim. " +
      "Do not change topic. Clear spoken English. 1–3 sentences. " +
      "Match the tone of real UPSC mock boards in the exemplars. " +
      "If MOVE=clarify, rephrase the LAST board question more simply — do not invent a new topic.";
    const user =
      `MOVE=${analysis.suggestedMove}\n` +
      `LAST_BOARD_QUESTION:\n${lastBoardText}\n` +
      `QUOTE_SNIPPET=${analysis.quoteSnippet}\n` +
      `CLAIMS=${JSON.stringify(analysis.extractClaims)}\n` +
      `BOARD_MEMORY:\n${memoryPromptBlock(memory)}\n` +
      `STYLE_FROM_MOCK_INTERVIEWS:\n${styleBlock}\n` +
      `LAST_ANSWER:\n${lastAnswer.text}\n` +
      `PROFILE:\n${JSON.stringify(profile)}\n` +
      `RECENT:\n${JSON.stringify(turns.slice(-8))}`;
    const llm = await boardLlmChat(system, user, 0.5, { purpose: "generate" });
    const line = firstLine(llm);
    if (
      line &&
      !isLowQualityQuestion(line, profile, lastBoardText, true)
    ) {
      question = line;
    } else {
      const fromCorpus = corpusFallbackQuestion(
        `${profile.name}|${category}|fu`,
        lastAnswer.text,
        true,
      );
      question = fromCorpus || fallbackFollowUp(profile, persona, lastAnswer.text);
      fallbackKind = fromCorpus ? "corpus" : "bank";
    }
  } else {
    const phase =
      boardN === 0
        ? "warm_welcome_intro"
        : boardN <= 2
          ? "polite_daf_probe"
          : "pressing_board";
    const system =
      personaSystem(persona, memory) +
      "\n\nGenerate a GENUINE spoken board question. Clear, flowing, not cryptic. 1–3 sentences. " +
      "Match real mock-board style from the exemplars. " +
      "If the candidate just answered, acknowledge briefly then ask something new that fits your domain.";
    const user =
      `PHASE=${phase}\nCATEGORY=${category}\n` +
      `BOARD_MEMORY:\n${memoryPromptBlock(memory)}\n` +
      `STYLE_FROM_MOCK_INTERVIEWS:\n${styleBlock}\n` +
      `PROFILE:\n${JSON.stringify(profile)}\n` +
      `PRIOR:\n${JSON.stringify(prior.slice(-8))}\n` +
      (lastAnswer ? `LAST_ANSWER:\n${lastAnswer.text}\n` : "") +
      `RECENT:\n${JSON.stringify(turns.slice(-10))}`;
    const llm = await boardLlmChat(system, user, 0.55, { purpose: "generate" });
    const line = firstLine(llm);
    if (line && !isLowQualityQuestion(line, profile, lastBoardText, false)) {
      question = line;
    } else {
      const fromCorpus = corpusFallbackQuestion(
        `${profile.name}|${category}|${boardN}|${persona.id}`,
        lastAnswer?.text,
        false,
      );
      question =
        fromCorpus || fallbackQuestion(profile, turns, persona, category);
      fallbackKind = fromCorpus ? "corpus" : "bank";
    }
    for (const p of prior) {
      if (p && question.toLowerCase().slice(0, 40) === p.toLowerCase().slice(0, 40)) {
        const fromCorpus = corpusFallbackQuestion(
          `${profile.name}|${category}|${boardN}|alt|${persona.id}`,
          lastAnswer?.text,
          false,
        );
        question =
          fromCorpus || fallbackQuestion(profile, turns, persona, category);
        fallbackKind = fromCorpus ? "corpus" : "bank";
        break;
      }
    }
  }

  if (!question.trim()) {
    return emergencyQuestion(profile, turns, memory);
  }

  if (analysis) {
    memory = applyAnalysisToMemory(
      memory,
      analysis,
      persona.id as PanelMemberId,
      category,
    );
  }

  const meta = getLastBoardLlmMeta();
  const llmSource =
    meta.source !== "none"
      ? meta.source
      : fallbackKind === "corpus"
        ? "corpus"
        : "bank";

  return {
    question,
    speakerId: persona.id,
    speakerName: persona.name,
    category,
    isFollowUp,
    memory,
    llmSource,
  };
}

function firstLine(text: string): string {
  if (!text) return "";
  let t = text.trim();
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim();
  return t.split("\n")[0]?.trim() || "";
}
