/**
 * Clean STT output — Web Speech on mobile often repeats phrases after restarts.
 */
export function sanitizeTranscript(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "";

  // Collapse consecutive duplicate words: "data data data" → "data"
  const words = text.split(" ");
  const dedupedWords: string[] = [];
  for (const w of words) {
    const prev = dedupedWords[dedupedWords.length - 1];
    if (prev && prev.toLowerCase() === w.toLowerCase()) continue;
    dedupedWords.push(w);
  }
  text = dedupedWords.join(" ");

  // Collapse consecutive repeated phrases (2–8 words), e.g.
  // "data protection data protection data protection" → "data protection"
  for (let n = 8; n >= 2; n--) {
    const parts = text.split(" ");
    const next: string[] = [];
    let i = 0;
    while (i < parts.length) {
      if (i + 2 * n <= parts.length) {
        const phrase = parts.slice(i, i + n).join(" ").toLowerCase();
        let repeats = 1;
        while (i + (repeats + 1) * n <= parts.length) {
          const nextPhrase = parts
            .slice(i + repeats * n, i + (repeats + 1) * n)
            .join(" ")
            .toLowerCase();
          if (nextPhrase === phrase) repeats += 1;
          else break;
        }
        if (repeats >= 2) {
          next.push(...parts.slice(i, i + n));
          i += repeats * n;
          continue;
        }
      }
      next.push(parts[i]!);
      i += 1;
    }
    text = next.join(" ");
  }

  return text.replace(/\s+/g, " ").trim();
}

/** Append a new final STT chunk without re-adding text already committed. */
export function appendTranscriptChunk(base: string, piece: string): string {
  const p = piece.replace(/\s+/g, " ").trim();
  if (!p) return base.trim();
  const b = base.replace(/\s+/g, " ").trim();
  if (!b) return p;

  const bLow = b.toLowerCase();
  const pLow = p.toLowerCase();

  if (bLow.endsWith(pLow)) return b;
  if (pLow.startsWith(bLow)) return p;
  if (bLow.includes(` ${pLow}`) || bLow.endsWith(` ${pLow}`)) return b;

  // Overlap: longest suffix of base that is a prefix of piece
  const bWords = b.split(" ");
  const pWords = p.split(" ");
  const max = Math.min(bWords.length, pWords.length);
  for (let len = max; len > 0; len--) {
    const suffix = bWords.slice(-len).join(" ").toLowerCase();
    const prefix = pWords.slice(0, len).join(" ").toLowerCase();
    if (suffix === prefix) {
      return sanitizeTranscript(`${bWords.slice(0, -len).join(" ")} ${p}`.trim());
    }
  }

  return sanitizeTranscript(`${b} ${p}`);
}
