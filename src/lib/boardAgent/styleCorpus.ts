import pack from "@/lib/boardAgent/data/board_style_pack.json";

export type StylePair = {
  board: string;
  priorAnswer?: string;
  candidateReply?: string;
  tags?: string[];
};

type StylePack = {
  version: number;
  source: string;
  pairCount: number;
  pairs: StylePair[];
};

const STYLE = pack as StylePack;

function tokens(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z]{4,}/g) || []).filter(
      (w) =>
        ![
          "that",
          "this",
          "with",
          "have",
          "from",
          "your",
          "about",
          "would",
          "what",
          "when",
          "were",
          "been",
          "they",
          "them",
          "then",
        ].includes(w),
    ),
  );
}

function scorePair(query: string, pair: StylePair): number {
  const q = tokens(query);
  if (!q.size) return 0;
  const blob = `${pair.board} ${pair.priorAnswer || ""} ${(pair.tags || []).join(" ")}`;
  const p = tokens(blob);
  let hit = 0;
  for (const w of q) if (p.has(w)) hit += 1;
  for (const tag of pair.tags || []) {
    if (query.toLowerCase().includes(tag)) hit += 2;
  }
  if (pair.priorAnswer) hit += 0.5;
  return hit;
}

/** Top style exemplars from mock-interview corpus for prompting / fallbacks. */
export function retrieveStyleExamples(
  query: string,
  n = 3,
): StylePair[] {
  const scored = STYLE.pairs
    .map((pair) => ({ pair, s: scorePair(query, pair) }))
    .sort((a, b) => b.s - a.s);
  const top = scored.filter((x) => x.s > 0).slice(0, n).map((x) => x.pair);
  if (top.length >= n) return top;
  // Fill with diverse high-quality pairs
  for (const p of STYLE.pairs) {
    if (top.length >= n) break;
    if (!top.includes(p) && p.board) top.push(p);
  }
  return top.slice(0, n);
}

export function stylePromptBlock(
  query: string,
  lastAnswer?: string | null,
): string {
  const q = [query, lastAnswer || ""].filter(Boolean).join("\n");
  const ex = retrieveStyleExamples(q, 3);
  if (!ex.length) return "(no style exemplars)";
  return ex
    .map((e, i) => {
      const prior = e.priorAnswer
        ? `PRIOR_ANSWER: ${e.priorAnswer.slice(0, 180)}`
        : "PRIOR_ANSWER: (none)";
      return `EXEMPLAR_${i + 1}:\n${prior}\nBOARD_SAID: ${e.board}`;
    })
    .join("\n\n");
}

/** Corpus-backed spoken turn when LLM is unavailable. */
export function corpusFallbackQuestion(
  seed: string,
  lastAnswer?: string | null,
  preferFollowUp = false,
): string {
  const q = [seed, lastAnswer || ""].filter(Boolean).join(" ");
  const ex = retrieveStyleExamples(q, 8);
  if (preferFollowUp && lastAnswer) {
    const withPrior = ex.find((e) => e.priorAnswer && e.board);
    if (withPrior) {
      const snip = lastAnswer.split(/\s+/).slice(0, 16).join(" ");
      // Adapt exemplar press to this candidate's words
      return (
        withPrior.board.replace(/\b(you said|you spoke about)[^.?]*/i, "").trim() ||
        `You said, roughly, "${snip}". Stay with that — what exactly would you do first, and who is affected?`
      );
    }
    const snip = lastAnswer.split(/\s+/).slice(0, 18).join(" ");
    return `You mentioned "${snip}". Give one concrete decision — not a speech — and who lives with the consequences.`;
  }
  const pick = ex[Math.abs(hash(seed)) % Math.max(1, ex.length)];
  return pick?.board || "Please introduce yourself briefly — education, hometown, and why you are here.";
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function styleCorpusMeta() {
  return {
    source: STYLE.source,
    pairCount: STYLE.pairCount,
    version: STYLE.version,
  };
}
