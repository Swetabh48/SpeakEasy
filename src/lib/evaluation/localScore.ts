import { getRubric } from "./rubrics";
import type { EvaluationRequest, EvaluationResult, ScoreDimension } from "./types";

const FILLERS =
  /\b(um+|uh+|like|you know|sort of|kind of|basically|actually|literally|so yeah|i mean)\b/gi;

function wordsOf(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function hasThesisSignals(text: string): boolean {
  return /\b(i (believe|argue|think|hold)|my (view|thesis|stance)|in conclusion|therefore|hence|to conclude|first(ly)?|second(ly)?|however|on the other hand)\b/i.test(
    text,
  );
}

function topicOverlap(topic: string, text: string): number {
  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "to",
    "in",
    "on",
    "for",
    "is",
    "are",
    "be",
    "as",
    "that",
    "this",
    "with",
    "by",
    "from",
    "it",
    "at",
  ]);
  const topicTokens = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
  if (!topicTokens.length) return 0.5;
  const body = text.toLowerCase();
  const hits = topicTokens.filter((t) => body.includes(t)).length;
  return hits / topicTokens.length;
}

/**
 * Strict local grader — evidence only. Empty / tiny content → near-zero.
 * Used when no LLM endpoint is available — evidence only.
 */
export function evaluateLocalStrict(req: EvaluationRequest): EvaluationResult {
  const rubric = getRubric(req);
  const raw = (req.transcriptOrEssay || "").trim();
  const words = wordsOf(raw);
  const wordCount = words.length;
  const durationSec = Math.max(0, req.durationSec);
  const targetSec = Math.max(1, req.targetSec);

  const insufficient =
    req.kind === "speech"
      ? wordCount < 25 || (durationSec > 0 && durationSec < 12 && wordCount < 40)
      : wordCount < 120;

  if (!raw || wordCount < 8) {
    const zeros: ScoreDimension[] = rubric.dimensions.map((d) => ({
      label: d.label,
      value: 0,
      weight: d.weight,
      note:
        req.kind === "speech"
          ? "No usable transcript — nothing spoken was captured. Score is zero."
          : "No usable essay text — upload a PDF with written content to be scored.",
    }));
    return {
      evaluated: true,
      source: "local-strict",
      insufficientEvidence: true,
      overall:
        "Not assessed on merit: insufficient content. Ending early without substance cannot produce exam marks.",
      band: "0 / Unevaluable",
      overallScore: 0,
      scores: zeros,
      tips: [
        "Speak or write fully before finishing.",
        "Allow microphone permission for speech sessions.",
        "For essays, upload a PDF of your written answer if you want a score.",
      ],
      strengths: [],
      weaknesses: ["No content submitted", "Time used without substance"],
      nextDrill: "Repeat the same topic and produce a complete attempt.",
      transcriptUsed: raw,
      wordCount,
      durationSec,
      targetSec,
    };
  }

  const fillerMatches = raw.match(FILLERS)?.length ?? 0;
  const fillerRatio = fillerMatches / Math.max(wordCount, 1);
  const overlap = topicOverlap(req.topic, raw);
  const thesis = hasThesisSignals(raw);
  const sentences = raw.split(/[.!?]+/).filter((s) => s.trim().length > 8).length;

  // Time discipline: ratio of useful words to time + adherence to target window
  const wordsPerMin = wordCount / Math.max(durationSec / 60, 0.05);
  let timeScore = 50;
  if (req.kind === "speech") {
    const ratio = durationSec / targetSec;
    if (durationSec < 8) timeScore = 2;
    else if (ratio < 0.25) timeScore = 12;
    else if (ratio < 0.5) timeScore = 28;
    else if (ratio <= 1.15) timeScore = 62;
    else if (ratio <= 1.4) timeScore = 48;
    else timeScore = 35;
    if (wordsPerMin < 40 && durationSec > 20) timeScore = Math.min(timeScore, 25);
    if (wordCount < 30) timeScore = Math.min(timeScore, 10);
  } else {
    // Essay: fitness by length bands (strict)
    if (wordCount < 120) timeScore = 8;
    else if (wordCount < 250) timeScore = 28;
    else if (wordCount < 500) timeScore = 48;
    else if (wordCount < 900) timeScore = 62;
    else if (wordCount <= 1400) timeScore = 70;
    else timeScore = 58; // bloated
  }

  let content = Math.round(18 + overlap * 55 + Math.min(20, sentences * 2));
  if (wordCount < 40) content = Math.min(content, 15);
  if (wordCount < 25) content = Math.min(content, 8);
  if (overlap < 0.15) content = Math.min(content, 22);

  let structure = thesis ? 48 : 28;
  structure += Math.min(25, Math.max(0, sentences - 2) * 3);
  if (wordCount < 40) structure = Math.min(structure, 12);

  let clarity = Math.round(70 - fillerRatio * 180);
  clarity = Math.max(5, Math.min(78, clarity));
  if (wordCount < 25) clarity = Math.min(clarity, 10);

  let presence = thesis ? 45 : 30;
  if (/\b(must|should|therefore|urgent|imperative|clearly)\b/i.test(raw)) presence += 12;
  if (fillerRatio > 0.08) presence -= 15;
  if (wordCount < 30) presence = Math.min(presence, 10);
  presence = Math.max(0, Math.min(75, presence));

  // Cap everything when insufficient
  if (insufficient) {
    content = Math.min(content, 22);
    structure = Math.min(structure, 18);
    clarity = Math.min(clarity, 20);
    presence = Math.min(presence, 15);
    timeScore = Math.min(timeScore, 18);
  }

  // Competitive ceiling for local grader — never inflate to vanity 88s
  const clampExam = (n: number) => Math.max(0, Math.min(78, Math.round(n)));

  const map: Record<string, { value: number; note: string }> = {
    content: {
      value: clampExam(content),
      note:
        overlap < 0.25
          ? "Weak tether to the topic keywords — examiners will call this drift."
          : "Some topic overlap detected; deepen with concrete examples and trade-offs.",
    },
    structure: {
      value: clampExam(structure),
      note: thesis
        ? "Some structural signals found; tighten pillar sequencing and close."
        : "Missing clear stance markers — boards punish structureless dumps.",
    },
    clarity: {
      value: clampExam(clarity),
      note:
        fillerRatio > 0.06
          ? `High filler density (~${Math.round(fillerRatio * 100)}%). Cut hedges.`
          : "Language control is adequate for a draft; aim crisper verbs.",
    },
    presence: {
      value: clampExam(presence),
      note: "Conviction inferred from wording only — substance must match tone.",
    },
    time: {
      value: clampExam(timeScore),
      note: `Used ${durationSec}s of ~${targetSec}s with ${wordCount} words.`,
    },
  };

  const scores: ScoreDimension[] = rubric.dimensions.map((d) => ({
    label: d.label,
    weight: d.weight,
    value: map[d.id]?.value ?? 0,
    note: map[d.id]?.note ?? d.toughGuide,
  }));

  const overallScore = Math.round(
    scores.reduce((s, x) => s + x.value * x.weight, 0) /
      Math.max(
        0.0001,
        scores.reduce((s, x) => s + x.weight, 0),
      ),
  );

  return {
    evaluated: true,
    source: "local-strict",
    insufficientEvidence: insufficient,
    overall: insufficient
      ? `Not enough content for a fair exam-style grade. Overall ${overallScore}/100.`
      : `Graded against ${rubric.title}. Overall ${overallScore}/100. ${rubric.passHint}`,
    band:
      overallScore < 25
        ? "Far below competitive"
        : overallScore < 45
          ? "Needs major work"
          : overallScore < 60
            ? "Borderline / uneven"
            : overallScore < 72
              ? "Promising but not safe"
              : "Competitive",
    overallScore,
    scores,
    tips: [
      rubric.passHint,
      "Prefer one sharp example over three vague claims.",
      "Name the strongest counterargument, then defeat it.",
      "Close with a forward line an examiner can tick.",
    ],
    strengths: scores.filter((s) => s.value >= 55).map((s) => s.label),
    weaknesses: scores.filter((s) => s.value < 45).map((s) => s.label),
    nextDrill:
      overallScore < 40
        ? "Same topic again — force a 3-part outline before you start."
        : "Harder difficulty + shorter prep on a related topic.",
    transcriptUsed: raw.slice(0, 8000),
    wordCount,
    durationSec,
    targetSec,
  };
}
