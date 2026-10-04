/** Detect candidate asking the board to repeat / clarify — not a real answer. */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const REPEAT_PATTERNS = [
  /\brepeat\b/,
  /\brepeat (the )?question\b/,
  /\bcan you (please )?repeat\b/,
  /\bcould you (please )?repeat\b/,
  /\bplease repeat\b/,
  /\bsay (that|it|the question) again\b/,
  /\bone more time\b/,
  /\bdidn'?t (hear|catch)\b/,
  /\bsorry.? (come again|pardon)\b/,
  /\bpardon\b/,
  /\bwhat was the question\b/,
  /\bplease (say|ask) again\b/,
  /\bsend the question\b/,
  /\bask (again|once more)\b/,
];

const CLARIFY_PATTERNS = [
  /\bdon'?t understand\b/,
  /\bdidn'?t understand\b/,
  /\bdo not understand\b/,
  /\bwhat do you mean\b/,
  /\bwhat does (that|this|it) mean\b/,
  /\bmore clear\b/,
  /\bmore clearly\b/,
  /\bbe (more )?clear\b/,
  /\bclarify\b/,
  /\bcan you (please )?explain\b/,
  /\bcould you (please )?explain\b/,
  /\bexplain (the|this|that) question\b/,
  /\bi (am )?(confused|lost)\b/,
  /\bnot (getting|following) (it|this|you)\b/,
  /\bsimplify\b/,
  /\bin (simple|simpler|plain) (words|terms)\b/,
  /\bi don'?t (get|follow) (it|this|you)?\b/,
  /\bi don'?t know (what|about)\b/,
  /\bi do not know (what|about)\b/,
  /\bno idea what\b/,
];

/** Candidate stuck on a term or asking what something is — not answering. */
const TERM_CONFUSION_PATTERNS = [
  /\bwhat (even )?is\b/,
  /\bwhat (even )?are\b/,
  /\bwhat'?s (a |an |the )?\w+/,
  /\bmeaning of\b/,
  /\bi (never )?heard of\b/,
  /\bnever heard (of|about)\b/,
  /\bwhich (one|thing|policy|scheme)\b/,
  /\bhuh\b/,
  /\bcome again\b/,
];

/** Common abuse — boards must reprimand, never ignore. */
const ABUSE_PATTERNS = [
  /\b(fuck|fucking|fucked|fucker)\b/,
  /\b(shit|bullshit|crap)\b/,
  /\b(asshole|a\*\*hole|bastard|bitch)\b/,
  /\b(damn you|go to hell|shut up)\b/,
  /\b(idiot|moron|stupid (board|question|panel))\b/,
  /\b(mc|bc|bhenchod|madarchod|chutiya|gandu|saala)\b/,
  /\b(wtf|stfu)\b/,
];

export function isRepeatRequest(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  if (t.split(" ").length > 40) return false;
  return REPEAT_PATTERNS.some((p) => p.test(t));
}

export function isClarifyRequest(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  if (t.split(" ").length > 45) return false;
  return CLARIFY_PATTERNS.some((p) => p.test(t));
}

/** Short "what is X?" — candidate not answering the substance. */
export function isTermConfusionRequest(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  const words = t.split(" ").filter(Boolean);
  if (words.length > 18) return false;
  if (TERM_CONFUSION_PATTERNS.some((p) => p.test(t))) return true;
  if (words.length <= 6 && /\b(what|sorry|pardon|again)\b/.test(t)) return true;
  return false;
}

/** Repeat / clarify / term confusion — do not treat as a finished answer. */
export function isMetaQuestionRequest(text: string): boolean {
  return (
    isRepeatRequest(text) ||
    isClarifyRequest(text) ||
    isTermConfusionRequest(text)
  );
}

/** Pure "say it again" — safe to restate locally. Clarify needs the brain. */
export function isPureRepeatRequest(text: string): boolean {
  return (
    isRepeatRequest(text) &&
    !isClarifyRequest(text) &&
    !isTermConfusionRequest(text)
  );
}

export function containsAbusiveLanguage(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return ABUSE_PATTERNS.some((p) => p.test(t));
}

/** Last board turn looked like an opening intro ask. */
export function isIntroPrompt(question: string | null | undefined): boolean {
  if (!question) return false;
  return /\b(introduce yourself|introduction|tell us about yourself|make yourself comfortable)\b/i.test(
    question,
  );
}

/** Name-only / one-liner after an intro ask — board should press, not hop topics. */
export function isThinIntroAnswer(
  answer: string,
  lastBoardQuestion: string | null | undefined,
): boolean {
  if (!isIntroPrompt(lastBoardQuestion)) return false;
  const words = answer.trim().split(/\s+/).filter(Boolean);
  if (words.length < 35) return true;
  const t = normalize(answer);
  const hasEdu = /\b(school|college|university|degree|graduat|b\.?tech|b\.?a|m\.?a|engineer|studied)\b/.test(
    t,
  );
  const hasPlace = /\b(from|born|hometown|village|district|state|city)\b/.test(t);
  const hasWhy = /\b(civil service|upsc|ias|ips|public service|why i|want to)\b/.test(
    t,
  );
  return !(hasEdu || hasPlace || hasWhy);
}
