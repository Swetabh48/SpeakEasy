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

/** Minimum retrieval score before a corpus line may be spoken to the candidate. */
const MIN_SPOKEN_SCORE = 2.5;

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
          "please",
          "briefly",
          "before",
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

/** Top style exemplars for prompting (may include weaker fills for few-shot only). */
export function retrieveStyleExamples(
  query: string,
  n = 3,
): StylePair[] {
  const scored = STYLE.pairs
    .map((pair) => ({ pair, s: scorePair(query, pair) }))
    .sort((a, b) => b.s - a.s);
  const top = scored.filter((x) => x.s > 0).slice(0, n).map((x) => x.pair);
  if (top.length >= n) return top;
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

/**
 * Corpus line only when retrieval actually matches the moment.
 * Returns "" so the orchestrator uses DAF-grounded banks instead of random PDF lines.
 */
export function corpusFallbackQuestion(
  seed: string,
  lastAnswer?: string | null,
  preferFollowUp = false,
): string {
  const q = [seed, lastAnswer || ""].filter(Boolean).join(" ");
  const scored = STYLE.pairs
    .map((pair) => ({ pair, s: scorePair(q, pair) }))
    .sort((a, b) => b.s - a.s);

  if (preferFollowUp && lastAnswer) {
    const withPrior = scored.find(
      (x) => x.s >= MIN_SPOKEN_SCORE && x.pair.priorAnswer && x.pair.board,
    );
    if (withPrior) {
      const snip = lastAnswer.split(/\s+/).slice(0, 16).join(" ");
      return (
        withPrior.pair.board
          .replace(/\b(you said|you spoke about)[^.?]*/i, "")
          .trim() ||
        `You said, roughly, "${snip}". Stay with that — what exactly would you do first, and who is affected?`
      );
    }
    return "";
  }

  const eligible = scored.filter((x) => x.s >= MIN_SPOKEN_SCORE);
  if (!eligible.length) return "";
  const pick = eligible[Math.abs(hash(seed)) % eligible.length];
  return pick?.pair.board || "";
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
