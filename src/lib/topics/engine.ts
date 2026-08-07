import { topicFingerprint } from "./fingerprint";
import { DEEP_RESEARCH_FRAMES, DEEP_RESEARCH_TOPICS } from "./deepResearch";
import {
  DIFFICULTIES,
  MODES,
  REGIONS,
  type Difficulty,
  type Mode,
} from "./banks";
import {
  estimateExamTopicSpace,
  getExamById,
  type Exam,
} from "./exams";
import {
  CATEGORIES,
  SUBJECTS,
  categoryLabel,
  type Category,
} from "./fields";

export type { Category, Difficulty, Mode, Exam };
export { CATEGORIES, DIFFICULTIES, MODES, categoryLabel };
export { EXAM_CATALOG, estimateExamTopicSpace, getExamById, searchExams } from "./exams";

export type Topic = {
  id: string;
  text: string;
  mode: Mode;
  category: Exclude<Category, "all">;
  difficulty: Difficulty;
  region: string;
  subject: string;
  examId: string | null;
  examName: string | null;
  examTags: string[];
  lengthKind: string;
};

export type TopicFilters = {
  mode: Mode;
  category: Category;
  difficulty: Difficulty;
  examId: string | null;
  /** Free-text field when user wants a topic domain not in the chip list */
  customField?: string | null;
};

const CATEGORY_KEYS = Object.keys(SUBJECTS) as Exclude<Category, "all">[];

const OPEN_ESSAYS = [
  "The time to repair the roof is when the sun is shining",
  "Technology as the quiet force in daily life",
  "Education without values is incomplete",
  "Social media is a selfish medium — discuss",
  "Growth that leaves people behind is not growth",
  "Climate justice is incomplete without social justice",
  "Is competition always good for the young?",
  "Silence of good people strengthens bad systems",
  "Artificial Intelligence will not replace humans; humans with AI will",
  "Culture is what we are; civilization is what we have",
  "Profit is not a purpose; it is a result",
  "Destiny of a nation is shaped in its classrooms",
  "Privacy in a surveillance age",
  "Is unpaid community service a fair school requirement?",
  "Nationalism without compassion becomes exclusion",
  "Words are sharper than a two-edged sword",
  "Can kindness be a strategic advantage?",
  "Universities should disturb the comfortable",
  "Financial inclusion without literacy is incomplete",
  "With greater power comes greater responsibility",
];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export { topicFingerprint } from "./fingerprint";

function isUnseen(text: string, seen: Set<string>): boolean {
  return !seen.has(topicFingerprint(text));
}

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function shufflePick<T>(rng: () => number, items: readonly T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(rng() * items.length)]!;
}

function unseenFrom(pool: readonly string[], seen: Set<string>): string[] {
  return pool.filter((t) => isUnseen(t, seen));
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function difficultyFromSeed(rng: () => number, preferred: Difficulty): Difficulty {
  if (preferred !== "standard") return preferred;
  return pick(rng, DIFFICULTIES);
}

function resolveCategory(
  rng: () => number,
  filters: TopicFilters,
  exam: Exam | null,
): Exclude<Category, "all"> {
  if (filters.category !== "all") return filters.category;
  if (exam?.fields.length) return pick(rng, exam.fields);
  return pick(rng, CATEGORY_KEYS);
}

function essayCandidatePool(exam: Exam | null, filters: TopicFilters): string[] {
  const custom = filters.customField?.trim();
  if (custom) {
    const seed = custom;
    return [
      seed,
      capitalize(seed),
      `The debate on ${seed.toLowerCase()}`,
      `Revisiting ${seed.toLowerCase()}`,
      `${capitalize(seed)} today`,
      `${capitalize(seed)} and public ethics`,
      `${capitalize(seed)} in an unequal world`,
      `Is ${seed.toLowerCase()} reshaping our institutions?`,
      `Beyond slogans: ${seed.toLowerCase()}`,
      ...(exam?.essayTopics.filter((t) =>
        t.toLowerCase().includes(seed.toLowerCase().slice(0, 12)),
      ) ?? []),
    ];
  }

  if (exam) {
    const pool = [...exam.essayTopics];
    for (const theme of exam.themes) {
      pool.push(
        capitalize(theme),
        `The debate on ${theme}`,
        `Revisiting ${theme}`,
        `${capitalize(theme)} today`,
        `${capitalize(theme)} and public ethics`,
      );
    }
    return [...new Set(pool)];
  }

  const extras =
    filters.category === "all"
      ? []
      : SUBJECTS[filters.category].map((s) => capitalize(s));
  return [...new Set([...OPEN_ESSAYS, ...extras])];
}

function speakCandidatePool(exam: Exam | null, filters: TopicFilters): string[] {
  const custom = filters.customField?.trim();
  if (custom) {
    const region = exam?.region ?? "your society";
    return [
      custom,
      `${custom} in ${region}`,
      `The future of ${custom}`,
      `Is ${custom} inevitable?`,
      `Should ${region} rethink ${custom}?`,
      capitalize(custom),
      `${custom} and young citizens`,
      `${custom} versus competing priorities`,
    ];
  }

  if (exam) {
    const region = exam.region;
    const pool = new Set<string>();
    for (const theme of exam.themes) {
      pool.add(theme);
      pool.add(`${theme} in ${region}`);
      pool.add(`The future of ${theme}`);
      pool.add(`Is ${theme} inevitable?`);
      pool.add(`Should ${region} rethink ${theme}?`);
    }
    if (filters.category !== "all") {
      for (const s of SUBJECTS[filters.category].slice(0, 10)) pool.add(s);
    }
    return [...pool];
  }

  const cats = filters.category === "all" ? CATEGORY_KEYS : [filters.category];
  const pool = new Set<string>();
  for (const cat of cats) {
    for (const s of SUBJECTS[cat]) {
      pool.add(s);
      pool.add(`The future of ${s}`);
      pool.add(`Is ${s} inevitable?`);
    }
  }
  return [...pool];
}

export function estimateTopicSpace(examId?: string | null, mode?: Mode): number {
  const exam = getExamById(examId);
  if (exam) {
    return estimateExamTopicSpace(exam, mode === "essay" ? "essay" : "speak");
  }
  let total = OPEN_ESSAYS.length * 80;
  for (const category of CATEGORY_KEYS) {
    total += SUBJECTS[category].length * REGIONS.length * 8;
  }
  return total;
}

function finalizeTopic(
  text: string,
  filters: TopicFilters,
  extras: {
    category: Exclude<Category, "all">;
    difficulty: Difficulty;
    region: string;
    subject: string;
    exam: Exam | null;
    lengthKind: string;
  },
): Topic {
  return {
    id: topicFingerprint(text),
    text,
    mode: filters.mode,
    category: extras.category,
    difficulty: extras.difficulty,
    region: extras.region,
    subject: extras.subject,
    examId: extras.exam?.id ?? null,
    examName: extras.exam?.shortName ?? null,
    examTags: extras.exam
      ? [extras.exam.shortName, filters.mode === "essay" ? "Essay" : modeLabel(filters.mode)]
      : [modeLabel(filters.mode), categoryLabel(extras.category)],
    lengthKind: extras.lengthKind,
  };
}

function novelVariant(
  rng: () => number,
  basePool: string[],
  seen: Set<string>,
  salt: number,
): string | null {
  for (let i = 0; i < 100; i++) {
    const base = pick(rng, basePool);
    const n = (salt + i) % 6;
    const lowered = base.charAt(0).toLowerCase() + base.slice(1);
    const text =
      n === 0
        ? `A closer look at ${lowered}`
        : n === 1
          ? `${base.replace(/\?$/, "")} — a balanced view`
          : n === 2
            ? `Why ${lowered.replace(/\?$/, "")} matters now`
            : n === 3
              ? `Rethinking ${lowered}`
              : n === 4
                ? `Perspectives on ${lowered}`
                : `${capitalize(base)} in public life`;
    if (isUnseen(text, seen)) return text;
  }
  return null;
}

function deepResearchPool(filters: TopicFilters): string[] {
  const custom = filters.customField?.trim();
  const pool: string[] = [];
  for (const core of DEEP_RESEARCH_TOPICS) {
    for (const frame of DEEP_RESEARCH_FRAMES) {
      pool.push(frame(core));
    }
  }
  if (custom) {
    pool.push(
      `Conduct a 10-minute deep dive on ${custom}: find mechanisms, data, and a serious counterargument before you speak.`,
      `Research ${custom} across at least two continents — where does the popular narrative break?`,
      `${capitalize(custom)} under stress: reconstruct one historical failure and one partial success with evidence.`,
      `Map incentives around ${custom} — winners, losers, measurement gaps, and what a skeptical examiner would ask next.`,
    );
  }
  if (filters.category !== "all") {
    const seeds = SUBJECTS[filters.category].slice(0, 8);
    for (const s of seeds) {
      pool.push(
        `Deep research: ${s} — identify causal mechanisms, quantify trade-offs, and prepare a 3-minute evidence brief.`,
      );
    }
  }
  return [...new Set(pool)];
}

/**
 * Draw a topic whose text has not appeared on this device yet.
 * Uniqueness is by content fingerprint, not by random draw id.
 */
export function drawTopic(
  filters: TopicFilters,
  seen: Set<string>,
  attemptSalt = Date.now(),
): Topic {
  const rng = mulberry32(hashString(`${attemptSalt}|${seen.size}|${Math.random()}`));
  const exam = getExamById(filters.examId);
  const category = resolveCategory(rng, filters, exam);
  const difficulty =
    filters.difficulty === "standard"
      ? difficultyFromSeed(rng, filters.difficulty)
      : filters.difficulty;
  const region = exam?.region ?? pick(rng, REGIONS);

  const basePool =
    filters.mode === "essay"
      ? essayCandidatePool(exam, filters)
      : filters.mode === "deep-research"
        ? deepResearchPool(filters)
        : speakCandidatePool(exam, filters);

  const fresh = unseenFrom(basePool, seen);
  let text: string | null = shufflePick(rng, fresh);

  if (!text) {
    text = novelVariant(
      rng,
      basePool.length ? basePool : OPEN_ESSAYS,
      seen,
      attemptSalt,
    );
  }

  if (!text) {
    const base = pick(rng, basePool.length ? basePool : OPEN_ESSAYS);
    let i = 0;
    do {
      text = `${base} · variation ${(seen.size + i + 1).toString(36)}`;
      i += 1;
    } while (!isUnseen(text, seen) && i < 80);
  }

  const finalText = text!;
  return finalizeTopic(finalText, filters, {
    category,
    difficulty,
    region,
    subject: finalText,
    exam,
    lengthKind:
      filters.mode === "essay"
        ? "essay"
        : filters.mode === "deep-research"
          ? "deep-research"
          : "speak",
  });
}

export function modeLabel(mode: Mode): string {
  const map: Record<Mode, string> = {
    impromptu: "Impromptu",
    debate: "Debate",
    interview: "Interview",
    ielts: "IELTS / Fluency",
    group: "Group Discussion",
    pitch: "Pitch",
    essay: "Essay topic",
    "deep-research": "Deep research",
  };
  return map[mode];
}

export function difficultyLabel(d: Difficulty): string {
  const map: Record<Difficulty, string> = {
    "warm-up": "Warm-up",
    standard: "Standard",
    challenge: "Challenge",
    "exam-hard": "Exam-hard",
  };
  return map[d];
}
