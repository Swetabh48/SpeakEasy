import { followUpHints, shouldFollowUp } from "@/lib/boardAgent/followup";
import { fallbackFollowUp, fallbackQuestion } from "@/lib/boardAgent/generate";
import { boardLlmChat } from "@/lib/boardAgent/llm";
import {
  inferCategory,
  personaSystem,
  pickPersona,
  type AgentTurn,
} from "@/lib/boardAgent/personas";
import type { CandidateProfile } from "@/lib/topics/board";

export type NextQuestionResult = {
  question: string;
  speakerId: string;
  speakerName: string;
  category: string;
  isFollowUp: boolean;
};

export async function nextBoardQuestion(
  profile: CandidateProfile,
  turns: AgentTurn[],
): Promise<NextQuestionResult> {
  const lastAnswer = [...turns].reverse().find((t) => t.role === "candidate");
  const isFollowUp = Boolean(
    lastAnswer && shouldFollowUp(lastAnswer.text, turns),
  );
  const boardN = turns.filter((t) => t.role === "board").length;
  const category = inferCategory(profile, boardN, isFollowUp);
  const persona = pickPersona(profile, turns, category, isFollowUp);

  const prior = turns.filter((t) => t.role === "board").map((t) => t.text);
  let question = "";

  if (isFollowUp && lastAnswer) {
    const system =
      personaSystem(persona) +
      "\n\nCROSS-QUESTION the last answer. Do not change topic. Clear spoken English. 1–3 sentences.";
    const user = `HINTS=${followUpHints(lastAnswer.text)}\nLAST_ANSWER:\n${lastAnswer.text}\nPROFILE:\n${JSON.stringify(profile)}\nRECENT:\n${JSON.stringify(turns.slice(-8))}`;
    const llm = await boardLlmChat(system, user, 0.5);
    question = firstLine(llm) || fallbackFollowUp(profile, persona, lastAnswer.text);
  } else {
    const phase =
      boardN === 0
        ? "warm_welcome_intro"
        : boardN <= 2
          ? "polite_daf_probe"
          : "pressing_board";
    const system =
      personaSystem(persona) +
      "\n\nGenerate a GENUINE spoken board question. Clear, flowing, not cryptic. 1–3 sentences.";
    const user = `PHASE=${phase}\nCATEGORY=${category}\nPROFILE:\n${JSON.stringify(profile)}\nPRIOR:\n${JSON.stringify(prior.slice(-8))}\nRECENT:\n${JSON.stringify(turns.slice(-10))}`;
    const llm = await boardLlmChat(system, user, 0.55);
    question = firstLine(llm) || fallbackQuestion(profile, turns, persona, category);
    for (const p of prior) {
      if (p && question.toLowerCase().slice(0, 40) === p.toLowerCase().slice(0, 40)) {
        question = fallbackQuestion(profile, turns, persona, category);
        break;
      }
    }
  }

  return {
    question,
    speakerId: persona.id,
    speakerName: persona.name,
    category,
    isFollowUp,
  };
}

function firstLine(text: string): string {
  if (!text) return "";
  let t = text.trim();
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).trim();
  return t.split("\n")[0]?.trim() || "";
}
