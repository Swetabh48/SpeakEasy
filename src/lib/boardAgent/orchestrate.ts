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
import type { PanelMemberId } from "@/lib/boardPanel";
import type { CandidateProfile } from "@/lib/topics/board";

export type NextQuestionResult = {
  question: string;
  speakerId: string;
  speakerName: string;
  category: string;
  isFollowUp: boolean;
  memory: BoardMemory;
  llmSource: "evaluator" | "ollama" | "corpus" | "bank";
};

export async function nextBoardQuestion(
  profile: CandidateProfile,
  turns: AgentTurn[],
  priorMemory?: BoardMemory | null,
): Promise<NextQuestionResult> {
  let memory = priorMemory ? { ...priorMemory, dafCoverage: { ...priorMemory.dafCoverage }, memberNotes: { ...priorMemory.memberNotes }, claims: [...priorMemory.claims], openThreads: [...priorMemory.openThreads] } : emptyBoardMemory();

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

  if (isFollowUp && lastAnswer && analysis) {
    const system =
      personaSystem(persona, memory) +
      "\n\nCROSS-QUESTION the last answer. Quote or paraphrase one concrete claim. " +
      "Do not change topic. Clear spoken English. 1–3 sentences. " +
      "Match the tone of real UPSC mock boards in the exemplars.";
    const user =
      `MOVE=${analysis.suggestedMove}\n` +
      `QUOTE_SNIPPET=${analysis.quoteSnippet}\n` +
      `CLAIMS=${JSON.stringify(analysis.extractClaims)}\n` +
      `BOARD_MEMORY:\n${memoryPromptBlock(memory)}\n` +
      `STYLE_FROM_MOCK_INTERVIEWS:\n${styleBlock}\n` +
      `LAST_ANSWER:\n${lastAnswer.text}\n` +
      `PROFILE:\n${JSON.stringify(profile)}\n` +
      `RECENT:\n${JSON.stringify(turns.slice(-8))}`;
    const llm = await boardLlmChat(system, user, 0.5, { purpose: "generate" });
    if (firstLine(llm)) {
      question = firstLine(llm);
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
    if (firstLine(llm)) {
      question = firstLine(llm);
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
