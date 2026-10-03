import type { PanelMemberId, PanelDomain } from "@/lib/boardPanel";

export type BoardMove =
  | "press"
  | "clarify"
  | "new_topic"
  | "invite_example"
  | "bridge_close";

export type OpenThread = {
  topic: string;
  ownerSpeakerId: PanelMemberId;
  whyOpen: string;
};

export type DafCoverage = {
  hometown: "none" | "thin" | "probed";
  education: "none" | "thin" | "probed";
  optionalOrTech: "none" | "thin" | "probed";
  work: "none" | "thin" | "probed";
  hobbies: "none" | "thin" | "probed";
  motivation: "none" | "thin" | "probed";
};

export type BoardMemory = {
  claims: string[];
  openThreads: OpenThread[];
  dafCoverage: DafCoverage;
  pressureLevel: number;
  memberNotes: Partial<Record<PanelMemberId, string>>;
};

export type AnswerAnalysis = {
  specificity: number;
  hedging: number;
  contradictionRisk: number;
  extractClaims: string[];
  suggestedMove: BoardMove;
  bestSpeakerDomain: PanelDomain;
  threadTopic: string;
  quoteSnippet: string;
  source: "llm" | "heuristic";
};

export function emptyBoardMemory(): BoardMemory {
  return {
    claims: [],
    openThreads: [],
    dafCoverage: {
      hometown: "none",
      education: "none",
      optionalOrTech: "none",
      work: "none",
      hobbies: "none",
      motivation: "none",
    },
    pressureLevel: 0.2,
    memberNotes: {},
  };
}

export function memoryPromptBlock(memory: BoardMemory): string {
  const threads = memory.openThreads
    .slice(0, 4)
    .map((t) => `- [${t.ownerSpeakerId}] ${t.topic}: ${t.whyOpen}`)
    .join("\n");
  const claims = memory.claims.slice(-8).map((c) => `- ${c}`).join("\n");
  const notes = Object.entries(memory.memberNotes)
    .map(([id, note]) => `- ${id}: ${note}`)
    .join("\n");
  return (
    `PRESSURE=${memory.pressureLevel.toFixed(2)}\n` +
    `DAF_COVERAGE=${JSON.stringify(memory.dafCoverage)}\n` +
    `CLAIMS:\n${claims || "(none)"}\n` +
    `OPEN_THREADS:\n${threads || "(none)"}\n` +
    `MEMBER_NOTES:\n${notes || "(none)"}`
  );
}

function bumpCoverage(
  current: DafCoverage[keyof DafCoverage],
  level: "thin" | "probed",
): DafCoverage[keyof DafCoverage] {
  if (current === "probed") return "probed";
  if (level === "probed") return "probed";
  if (current === "thin") return "thin";
  return level;
}

export function applyAnalysisToMemory(
  memory: BoardMemory,
  analysis: AnswerAnalysis,
  speakerId: PanelMemberId,
  category: string,
): BoardMemory {
  const next: BoardMemory = {
    claims: [...memory.claims],
    openThreads: [...memory.openThreads],
    dafCoverage: { ...memory.dafCoverage },
    pressureLevel: memory.pressureLevel,
    memberNotes: { ...memory.memberNotes },
  };

  for (const c of analysis.extractClaims) {
    const clean = c.trim().slice(0, 160);
    if (clean && !next.claims.includes(clean)) next.claims.push(clean);
  }
  next.claims = next.claims.slice(-16);

  const pressMoves: BoardMove[] = ["press", "clarify", "invite_example"];
  if (pressMoves.includes(analysis.suggestedMove) && analysis.threadTopic) {
    const existing = next.openThreads.find(
      (t) => t.topic.toLowerCase() === analysis.threadTopic.toLowerCase(),
    );
    if (existing) {
      existing.whyOpen = analysis.threadTopic
        ? `${analysis.suggestedMove}: needs more specificity`
        : existing.whyOpen;
      existing.ownerSpeakerId = speakerId;
    } else {
      next.openThreads.push({
        topic: analysis.threadTopic.slice(0, 120),
        ownerSpeakerId: speakerId,
        whyOpen: `${analysis.suggestedMove} — candidate was thin/hedged`,
      });
    }
  } else if (analysis.suggestedMove === "new_topic" || analysis.suggestedMove === "bridge_close") {
    next.openThreads = next.openThreads.filter(
      (t) => t.ownerSpeakerId !== speakerId,
    );
  }
  next.openThreads = next.openThreads.slice(-6);

  const cat = category.toLowerCase();
  const level =
    analysis.specificity >= 0.55 ? "probed" : ("thin" as const);
  if (cat.includes("welcome") || cat.includes("daf") || cat.includes("hobby")) {
    next.dafCoverage.hometown = bumpCoverage(next.dafCoverage.hometown, level);
    next.dafCoverage.motivation = bumpCoverage(next.dafCoverage.motivation, "thin");
  }
  if (cat.includes("hobby")) {
    next.dafCoverage.hobbies = bumpCoverage(next.dafCoverage.hobbies, level);
  }
  if (cat.includes("optional") || cat.includes("technical")) {
    next.dafCoverage.optionalOrTech = bumpCoverage(
      next.dafCoverage.optionalOrTech,
      level,
    );
  }
  if (cat.includes("ethics") || cat.includes("affairs") || cat.includes("personality")) {
    next.dafCoverage.education = bumpCoverage(next.dafCoverage.education, "thin");
  }

  const delta =
    analysis.suggestedMove === "press" || analysis.suggestedMove === "clarify"
      ? 0.12
      : analysis.suggestedMove === "invite_example"
        ? 0.08
        : -0.06;
  next.pressureLevel = Math.min(0.95, Math.max(0.1, next.pressureLevel + delta));

  const note = analysis.quoteSnippet
    ? `Candidate said roughly: "${analysis.quoteSnippet.slice(0, 80)}". Move=${analysis.suggestedMove}.`
    : `Last move=${analysis.suggestedMove}; specificity=${analysis.specificity.toFixed(2)}`;
  next.memberNotes[speakerId] = note;

  return next;
}

export function thinDafFields(memory: BoardMemory): string[] {
  return (Object.entries(memory.dafCoverage) as [keyof DafCoverage, DafCoverage[keyof DafCoverage]][])
    .filter(([, v]) => v === "none" || v === "thin")
    .map(([k]) => k);
}
