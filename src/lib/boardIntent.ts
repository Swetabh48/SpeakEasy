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
  // Allow slightly longer utterances that are still only asking to hear it again
  if (t.split(" ").length > 40) return false;
  return REPEAT_PATTERNS.some((p) => p.test(t));
}

export function isClarifyRequest(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  if (t.split(" ").length > 45) return false;
  return CLARIFY_PATTERNS.some((p) => p.test(t));
}

/** Repeat or clarify — do not advance the interview. */
export function isMetaQuestionRequest(text: string): boolean {
  return isRepeatRequest(text) || isClarifyRequest(text);
}

export function containsAbusiveLanguage(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return ABUSE_PATTERNS.some((p) => p.test(t));
}

/** Plain-language restatement for confused candidates. */
export function clarifyQuestionText(question: string): string {
  const q = question.trim();
  return (
    `Of course — let me say that more simply. ${q} ` +
    `Answer in plain terms: what you would do, and why.`
  );
}
