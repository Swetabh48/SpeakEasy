import { createHash } from "crypto";
import type { PanelDomain, PanelMember, PanelMemberId } from "@/lib/boardPanel";
import { BOARD_PANEL, getPanelMember } from "@/lib/boardPanel";
import type { AnswerAnalysis, BoardMemory, BoardMove } from "@/lib/boardAgent/memory";
import type { CandidateProfile } from "@/lib/topics/board";

export type AgentTurn = {
  role: "board" | "candidate";
  text: string;
  speakerId?: string;
  speakerName?: string;
  category?: string;
  isFollowUp?: boolean;
};

export function hashPick(seed: string, items: string[]): string {
  if (!items.length) return "";
  const h = createHash("sha256").update(seed).digest();
  const n = h.readUInt32BE(0);
  return items[n % items.length]!;
}

export function hashRatio(seed: string): number {
  const h = createHash("sha256").update(seed).digest();
  return (h.readUInt32BE(0) % 10000) / 10000;
}

const DOMAIN_TO_ID: Record<PanelDomain, PanelMemberId> = {
  "chair-daf": "chair",
  subject: "member-a",
  "affairs-ethics": "member-b",
  quiet: "member-c",
  skeptic: "member-d",
};

export function inferCategory(
  profile: CandidateProfile,
  boardN: number,
  isFollowUp: boolean,
  move?: BoardMove,
  memory?: BoardMemory,
): string {
  if (isFollowUp) return "follow-up";
  if (boardN === 0) return "welcome";
  if (move === "bridge_close" || (memory && memory.pressureLevel > 0.85 && boardN >= 7)) {
    return "close";
  }
  if (boardN <= 2) return "daf";

  // Prefer thin DAF coverage before random categories
  if (memory) {
    if (memory.dafCoverage.hobbies === "none" && boardN >= 3) return "hobby";
    if (
      memory.dafCoverage.optionalOrTech === "none" &&
      (profile.optionalSubject || profile.engineeringBranch)
    ) {
      return profile.optionalSubject ? "optional-subject" : "technical";
    }
  }

  const seed = `${profile.name}|${boardN}|cat`;
  const r = hashRatio(seed);
  if ((profile.optionalSubject || profile.engineeringBranch) && r < 0.35) {
    return profile.optionalSubject ? "optional-subject" : "technical";
  }
  if (r < 0.55) return "ethics";
  if (r < 0.72) return "current-affairs";
  if (r < 0.85) return "hobby";
  return "personality";
}

export function pickPersona(
  profile: CandidateProfile,
  turns: AgentTurn[],
  category: string,
  isFollowUp: boolean,
  analysis?: AnswerAnalysis | null,
  memory?: BoardMemory | null,
): PanelMember {
  const boardN = turns.filter((t) => t.role === "board").length;
  const seed = `${profile.name}|${boardN}|${category}|${isFollowUp}`;

  if (boardN === 0 || category === "welcome") return getPanelMember("chair");
  if (category === "close") return getPanelMember("chair");

  // Unfinished thread: same owner, or skeptic escalation ~35%
  if (isFollowUp && memory?.openThreads?.length) {
    const thread = memory.openThreads[memory.openThreads.length - 1]!;
    if (hashRatio(seed + "|esc") < 0.35) return getPanelMember("member-d");
    return getPanelMember(thread.ownerSpeakerId);
  }

  if (isFollowUp) {
    if (analysis?.bestSpeakerDomain && hashRatio(seed + "|dom") < 0.7) {
      return getPanelMember(DOMAIN_TO_ID[analysis.bestSpeakerDomain]);
    }
    if (hashRatio(seed + "|sk") < 0.35) return getPanelMember("member-d");
    const lastBoard = [...turns].reverse().find((t) => t.role === "board");
    const prev = lastBoard?.speakerId;
    if (prev && prev !== "member-c") {
      if (hashRatio(seed + "|esc") < 0.4) return getPanelMember("member-d");
      return getPanelMember(prev);
    }
    return getPanelMember("member-d");
  }

  // New topic: prefer analyzer domain when it fits category
  if (analysis?.bestSpeakerDomain && analysis.suggestedMove === "new_topic") {
    const id = DOMAIN_TO_ID[analysis.bestSpeakerDomain];
    if (category === "daf" || category === "hobby") {
      /* chair owns */
    } else if (
      (category === "optional-subject" || category === "technical") &&
      id === "member-a"
    ) {
      return getPanelMember("member-a");
    } else if (
      (category === "ethics" || category === "current-affairs") &&
      (id === "member-b" || id === "member-d")
    ) {
      return getPanelMember(id);
    } else if (category === "personality") {
      return getPanelMember(id === "member-c" || id === "member-d" ? id : "member-c");
    }
  }

  if (category === "daf" || category === "hobby") {
    return getPanelMember("chair");
  }
  if (category === "optional-subject" || category === "technical") {
    return getPanelMember("member-a");
  }
  if (category === "current-affairs" || category === "ethics") {
    if (category === "ethics" && hashRatio(seed + "|eth") < 0.22) {
      return getPanelMember("member-d");
    }
    return getPanelMember("member-b");
  }
  if (boardN >= 4 && hashRatio(seed + "|quiet") < 0.18) {
    return getPanelMember("member-c");
  }
  if (category === "personality") {
    return hashRatio(seed) < 0.55
      ? getPanelMember("member-c")
      : getPanelMember("member-d");
  }
  return getPanelMember("chair");
}

export function personaSystem(member: PanelMember, memory?: BoardMemory | null): string {
  const note = memory?.memberNotes?.[member.id as PanelMemberId];
  return (
    `You are ${member.name}, ${member.role} on an Indian government interview board.\n` +
    `Domain: ${member.domain}. Persona: ${member.persona}\n` +
    "Speak as this member only. One clear spoken turn — natural conversation, not a riddle.\n" +
    "No cryptic slogans. Prefer 1–3 plain sentences.\n" +
    (note ? `Your private note from earlier: ${note}\n` : "")
  );
}

export { BOARD_PANEL };
