import { analyzeAnswer, moveIsFollowUp } from "@/lib/boardAgent/analyze";
import {
  fallbackFollowUp,
  fallbackIncompleteIntro,
  fallbackQuestion,
} from "@/lib/boardAgent/generate";
import {
  boardLlmChat,
  getLastBoardLlmMeta,
  polishBoardDraft,
} from "@/lib/boardAgent/llm";
import {
  applyAnalysisToMemory,
  emptyBoardMemory,
  memoryPromptBlock,
  type BoardMemory,
  type BoardMove,
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
import {
  isMetaQuestionRequest,
  isThinIntroAnswer,
} from "@/lib/boardIntent";
import type { PanelDomain, PanelMemberId } from "@/lib/boardPanel";
import type { CandidateProfile } from "@/lib/topics/board";

/** Reject weak / off-profile generations so DAF banks take over. */
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
  const lead = q.match(/^([A-Z][a-z]{2,}),/);
  if (lead && first && lead[1].toLowerCase() !== first.toLowerCase()) return true;
  if (/\bdon'?t rush the meeting\b/i.test(q)) return true;
  if (requireFollowUp && lastBoard) {
    const boardTok = new Set(
      (lastBoard.toLowerCase().match(/[a-z]{4,}/g) || []).slice(0, 24),
    );
    const qTok = lower.match(/[a-z]{4,}/g) || [];
    const overlap = qTok.filter((w) => boardTok.has(w)).length;
    if (
      overlap === 0 &&
      /\b(budget|education system|gdp|inflation)\b/i.test(q)
    ) {
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
  /** evaluator = your trained model; evaluator+gemini = trained ask + Gemini polish */
  llmSource:
    | "evaluator"
    | "evaluator+gemini"
    | "ollama"
    | "corpus"
    | "bank";
};

function sourceLabel(): NextQuestionResult["llmSource"] | "none" {
  const meta = getLastBoardLlmMeta();
  if (meta.source === "none") return "none";
  if (meta.source === "ollama") return "ollama";
  if (meta.source === "evaluator" || meta.source === "gemini") {
    return meta.supported ? "evaluator+gemini" : "evaluator";
  }
  return "none";
}

/**
 * Your trained model drafts the spoken question; Gemini only polishes if the draft is unclear.
 * Gemini never invents the topic.
 */
async function questionFromTrainedBrain(
  system: string,
  user: string,
  temperature: number,
  profile: CandidateProfile,
  lastBoard: string,
  requireFollowUp: boolean,
  polishContext: string,
): Promise<string> {
  const llm = await boardLlmChat(system, user, temperature, {
    purpose: "generate",
  });
  let line = firstLine(llm);
  if (!line) return "";
  if (isLowQualityQuestion(line, profile, lastBoard, requireFollowUp)) {
    const polished = firstLine(await polishBoardDraft(line, polishContext));
    if (
      polished &&
      !isLowQualityQuestion(polished, profile, lastBoard, requireFollowUp)
    ) {
      return polished;
    }
    return "";
  }
  return line;
}

function emergencyQuestion(
  profile: CandidateProfile,
  turns: AgentTurn[],
  memory: BoardMemory,
): NextQuestionResult {
  const boardN = turns.filter((t) => t.role === "board").length;
  const category = inferCategory(profile, boardN, false, undefined, memory);
  const persona = pickPersona(profile, turns, category, false, null, memory);
  const lastAnswer = [...turns].reverse().find((t) => t.role === "candidate");
  const lastBoard = [...turns].reverse().find((t) => t.role === "board");
  if (lastAnswer && isThinIntroAnswer(lastAnswer.text, lastBoard?.text)) {
    return {
      question: fallbackIncompleteIntro(profile, persona),
      speakerId: persona.id,
      speakerName: persona.name,
      category: "welcome",
      isFollowUp: true,
      memory,
      llmSource: "bank",
    };
  }
  const fromCorpus = corpusFallbackQuestion(
    `${profile.name}|${category}|${boardN}|emergency|${persona.id}|${profile.homeState}|${profile.optionalSubject || ""}`,
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
    isFollowUp: Boolean(lastAnswer),
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
  const lastBoardText =
    [...turns].reverse().find((t) => t.role === "board")?.text || "";
  const boardN = turns.filter((t) => t.role === "board").length;

  let analysis = null;
  if (lastAnswer) {
    analysis = await analyzeAnswer(lastAnswer.text, profile, turns, memory);
  }

  // Incomplete introduction — force a press before any new topic.
  const thinIntro = Boolean(
    lastAnswer && isThinIntroAnswer(lastAnswer.text, lastBoardText),
  );
  if (thinIntro && analysis) {
    const introMove: BoardMove = "invite_example";
    const chairDomain: PanelDomain = "chair-daf";
    analysis = {
      ...analysis,
      suggestedMove: introMove,
      bestSpeakerDomain: chairDomain,
      threadTopic: "complete introduction",
    };
  }

  const isFollowUp = Boolean(
    thinIntro || (analysis && moveIsFollowUp(analysis.suggestedMove)),
  );
  const followMove: BoardMove | undefined = analysis?.suggestedMove;
  const category = thinIntro
    ? "welcome"
    : inferCategory(profile, boardN, isFollowUp, followMove, memory);
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

  // Gemini analysis notes — support your trained model; it still asks the question.
  const supportNotes = analysis
    ? `SUPPORT_NOTES (from answer understanding — follow these constraints):\n` +
      `suggestedMove=${analysis.suggestedMove}; thread=${analysis.threadTopic}; ` +
      `claims=${JSON.stringify(analysis.extractClaims)}; quote=${analysis.quoteSnippet}\n`
    : "";

  const polishCtx =
    `PROFILE:${JSON.stringify(profile)}\nLAST_BOARD:${lastBoardText}\n` +
    `LAST_ANSWER:${lastAnswer?.text || ""}\n${supportNotes}`;

  // Confused / "I don't know what X is" — YOUR model re-asks; Gemini only polishes if garbled.
  if (lastAnswer && isMetaQuestionRequest(lastAnswer.text) && lastBoardText) {
    const system =
      personaSystem(persona, memory) +
      "\n\nThe candidate did not understand the last question or a term in it. " +
      "Respond as a real UPSC mock board member in 1–3 spoken sentences (your mock-interview style). " +
      "Either (a) briefly define the unclear idea in plain words and re-ask a CLEAR version grounded in their DAF, " +
      "OR (b) politely leave that question and ask a fresh, simple question from their profile. " +
      "Never repeat an unclear phrase unchanged.";
    const user =
      supportNotes +
      `LAST_BOARD_QUESTION:\n${lastBoardText}\n` +
      `CANDIDATE_SAID:\n${lastAnswer.text}\n` +
      `PROFILE:\n${JSON.stringify(profile)}\n` +
      `STYLE_FROM_MOCK_INTERVIEWS:\n${styleBlock}\n` +
      `BOARD_MEMORY:\n${memoryPromptBlock(memory)}`;
    question = await questionFromTrainedBrain(
      system,
      user,
      0.4,
      profile,
      lastBoardText,
      false,
      polishCtx,
    );
    if (!question) {
      question = fallbackQuestion(profile, turns, persona, "daf-home");
      fallbackKind = "bank";
    }
    if (analysis) {
      const clarifyMove: BoardMove = "clarify";
      memory = applyAnalysisToMemory(
        memory,
        { ...analysis, suggestedMove: clarifyMove },
        persona.id as PanelMemberId,
        category,
      );
    }
    const src = sourceLabel();
    return {
      question,
      speakerId: persona.id,
      speakerName: persona.name,
      category,
      isFollowUp: true,
      memory,
      llmSource: src === "none" ? "bank" : src,
    };
  }

  if (thinIntro && lastAnswer) {
    const system =
      personaSystem(persona, memory) +
      "\n\nThe candidate gave only a thin introduction (often just a name). " +
      "Politely ask them to COMPLETE the introduction — education, hometown, why civil services. " +
      "Do not change topic. 1–2 spoken sentences in mock-board style.";
    const user =
      supportNotes +
      `PROFILE:\n${JSON.stringify(profile)}\n` +
      `LAST_ANSWER:\n${lastAnswer.text}\n` +
      `LAST_BOARD_QUESTION:\n${lastBoardText}\n` +
      `STYLE_FROM_MOCK_INTERVIEWS:\n${styleBlock}`;
    question = await questionFromTrainedBrain(
      system,
      user,
      0.4,
      profile,
      lastBoardText,
      true,
      polishCtx,
    );
    if (!question) {
      question = fallbackIncompleteIntro(profile, persona);
      fallbackKind = "bank";
    }
  } else if (isFollowUp && lastAnswer && analysis) {
    const system =
      personaSystem(persona, memory) +
      "\n\nCROSS-QUESTION the last answer. Quote or paraphrase one concrete claim. " +
      "Do not change topic. Clear spoken English. 1–3 sentences. " +
      "Match the tone of real UPSC mock boards in the exemplars.";
    const user =
      supportNotes +
      `MOVE=${analysis.suggestedMove}\n` +
      `LAST_BOARD_QUESTION:\n${lastBoardText}\n` +
      `QUOTE_SNIPPET=${analysis.quoteSnippet}\n` +
      `CLAIMS=${JSON.stringify(analysis.extractClaims)}\n` +
      `BOARD_MEMORY:\n${memoryPromptBlock(memory)}\n` +
      `STYLE_FROM_MOCK_INTERVIEWS:\n${styleBlock}\n` +
      `LAST_ANSWER:\n${lastAnswer.text}\n` +
      `PROFILE:\n${JSON.stringify(profile)}\n` +
      `RECENT:\n${JSON.stringify(turns.slice(-8))}`;
    question = await questionFromTrainedBrain(
      system,
      user,
      0.5,
      profile,
      lastBoardText,
      true,
      polishCtx,
    );
    if (!question) {
      const fromCorpus = corpusFallbackQuestion(
        `${profile.name}|${category}|fu|${profile.homeState}`,
        lastAnswer.text,
        true,
      );
      question =
        fromCorpus || fallbackFollowUp(profile, persona, lastAnswer.text);
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
      "Ground it in the candidate PROFILE (state, optional, education, work, hobbies). " +
      "Match real mock-board style from the exemplars. " +
      "If the candidate just answered, acknowledge briefly then ask something new that fits your domain.";
    const user =
      supportNotes +
      `PHASE=${phase}\nCATEGORY=${category}\n` +
      `BOARD_MEMORY:\n${memoryPromptBlock(memory)}\n` +
      `STYLE_FROM_MOCK_INTERVIEWS:\n${styleBlock}\n` +
      `PROFILE:\n${JSON.stringify(profile)}\n` +
      `PRIOR:\n${JSON.stringify(prior.slice(-8))}\n` +
      (lastAnswer ? `LAST_ANSWER:\n${lastAnswer.text}\n` : "") +
      `RECENT:\n${JSON.stringify(turns.slice(-10))}`;
    question = await questionFromTrainedBrain(
      system,
      user,
      0.55,
      profile,
      lastBoardText,
      false,
      polishCtx,
    );
    if (!question) {
      const fromCorpus = corpusFallbackQuestion(
        `${profile.name}|${category}|${boardN}|${persona.id}|${profile.homeState}|${profile.optionalSubject || ""}`,
        lastAnswer?.text,
        false,
      );
      question =
        fromCorpus || fallbackQuestion(profile, turns, persona, category);
      fallbackKind = fromCorpus ? "corpus" : "bank";
    }
    for (const p of prior) {
      if (
        p &&
        question.toLowerCase().slice(0, 40) === p.toLowerCase().slice(0, 40)
      ) {
        question = fallbackQuestion(profile, turns, persona, category);
        fallbackKind = "bank";
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

  const src = sourceLabel();
  const llmSource: NextQuestionResult["llmSource"] =
    src !== "none"
      ? src
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
