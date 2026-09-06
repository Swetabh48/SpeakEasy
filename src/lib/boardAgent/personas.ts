import { createHash } from "crypto";
import type { PanelMember } from "@/lib/boardPanel";
import { BOARD_PANEL, getPanelMember } from "@/lib/boardPanel";
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

export function inferCategory(
  profile: CandidateProfile,
  boardN: number,
  isFollowUp: boolean,
): string {
  if (isFollowUp) return "follow-up";
  if (boardN === 0) return "welcome";
  if (boardN <= 2) return "daf";
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
): PanelMember {
  const boardN = turns.filter((t) => t.role === "board").length;
  const seed = `${profile.name}|${boardN}|${category}|${isFollowUp}`;

  if (boardN === 0 || category === "welcome") return getPanelMember("chair");

  if (category === "follow-up" && hashRatio(seed + "|sk") < 0.35) {
    return getPanelMember("member-d");
  }

  if (isFollowUp) {
    const lastBoard = [...turns].reverse().find((t) => t.role === "board");
    const prev = lastBoard?.speakerId;
    if (prev && prev !== "member-c") {
      if (hashRatio(seed + "|esc") < 0.4) return getPanelMember("member-d");
      return getPanelMember(prev);
    }
    return getPanelMember("member-d");
  }

  if (category === "daf" || category === "hobby" || category === "close") {
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

export function personaSystem(member: PanelMember): string {
  return (
    `You are ${member.name}, ${member.role} on an Indian government interview board.\n` +
    `Domain: ${member.domain}. Persona: ${member.persona}\n` +
    "Speak as this member only. One clear spoken turn — natural conversation, not a riddle.\n" +
    "No cryptic slogans. Prefer 1–3 plain sentences."
  );
}

export { BOARD_PANEL };
