/** Exam-realistic (often tougher) rubrics used for LLM + local graders. */

export type Rubric = {
  title: string;
  standard: string;
  dimensions: { id: string; label: string; weight: number; toughGuide: string }[];
  passHint: string;
};

const SPEECH_COMMON = [
  {
    id: "content",
    label: "Content & relevance",
    weight: 0.28,
    toughGuide:
      "Does every sentence serve the topic? Vague generalities and slogan-speak are punished hard.",
  },
  {
    id: "structure",
    label: "Structure",
    weight: 0.2,
    toughGuide:
      "Clear thesis, 2–3 developed points, rebuttal/nuance, decisive close. Wandering = low.",
  },
  {
    id: "clarity",
    label: "Clarity & language",
    weight: 0.18,
    toughGuide:
      "Precise diction, few fillers, exam-appropriate register. Rambling or broken coherence sinks the score.",
  },
  {
    id: "presence",
    label: "Presence & conviction",
    weight: 0.14,
    toughGuide:
      "Inferred from wording: assertive stance, controlled emphasis, no hedging fog. Empty gusto without substance scores low.",
  },
  {
    id: "time",
    label: "Time discipline",
    weight: 0.2,
    toughGuide:
      "Content density vs allotted time. Quitting in seconds with no substance is near-zero. Overshooting without structure is penalized.",
  },
];

const ESSAY_COMMON = [
  {
    id: "content",
    label: "Content & depth",
    weight: 0.3,
    toughGuide:
      "Multi-dimensional analysis, evidence, and insight — not topic restatement. Thin essays fail.",
  },
  {
    id: "structure",
    label: "Structure & coherence",
    weight: 0.22,
    toughGuide:
      "Introduction with stance, sequenced paragraphs, transitions, conclusion that adds value.",
  },
  {
    id: "clarity",
    label: "Language & expression",
    weight: 0.18,
    toughGuide:
      "Grammatical control, vocabulary precision, academic tone. Error-dense writing is capped low.",
  },
  {
    id: "presence",
    label: "Argumentative force",
    weight: 0.15,
    toughGuide:
      "Balanced but decisive. Fence-sitting with no intellectual courage costs marks.",
  },
  {
    id: "time",
    label: "Length & exam fitness",
    weight: 0.15,
    toughGuide:
      "UPSC-like essays need substance (typically 1000–1200 words potential). Very short submissions score near zero on depth/fitness.",
  },
];

export function getRubric(input: {
  kind: "speech" | "essay";
  examId: string | null;
  examName: string | null;
  mode: string;
}): Rubric {
  const exam = (input.examName || input.examId || "Open practice").toUpperCase();

  if (input.kind === "essay" || input.mode === "essay") {
    if (/UPSC|PSC|CSS|BCS/i.test(exam)) {
      return {
        title: `${exam} Essay (strict board)`,
        standard:
          "Grade like a tough UPSC/State PCS essay examiner. Reward multidimensionality, examples, constitutional/ethical lenses, and originality. Penalize verbosity without insight, one-sided rants, and template fluff. Average good attempt ≈ 45–55/100. Outstanding rare >70.",
        dimensions: ESSAY_COMMON,
        passHint: "Target: layered intro, 4–6 body dimensions, fair counterview, forward-looking close.",
      };
    }
    if (/IELTS|TOEFL|PTE|CAMBRIDGE|DET/i.test(exam)) {
      return {
        title: `${exam} Writing (strict band)`,
        standard:
          "Apply IELTS Task 2 discipline harshly: task response, coherence, lexical resource, grammar. Band 7+ requires clear position and developed ideas. Under-length or off-topic collapses score.",
        dimensions: ESSAY_COMMON,
        passHint: "Clear position early; each paragraph one idea + support; formal register.",
      };
    }
    return {
      title: "Essay — competitive academic standard",
      standard:
        "Grade tougher than a sympathetic teacher. Content depth first, then structure, language, argumentative force, and fitness for timed exams.",
      dimensions: ESSAY_COMMON,
      passHint: "Substance over length theatre; every paragraph must earn its place.",
    };
  }

  if (/IELTS|TOEFL|PTE/i.test(exam) || input.mode === "ielts") {
    return {
      title: `${exam || "IELTS"} Speaking (strict)`,
      standard:
        "Grade fluency/coherence, lexical resource, grammar, pronunciation proxies from transcript (fillers, unfinished thoughts). Thin answers get low bands. No charity marks for attempting.",
      dimensions: SPEECH_COMMON,
      passHint: "Extend with reasons + example; keep relevance tight.",
    };
  }

  if (/DEBATE|WUDC|MUN|BP/i.test(exam) || input.mode === "debate") {
    return {
      title: "Debate / BP — adjudication strict",
      standard:
        "Reward clash, weighed argumentation, and role fulfillment. Rhetoric without comparative weighing is middling at best.",
      dimensions: SPEECH_COMMON,
      passHint: "Define, argue, weigh, close. Rebut the strongest opposite view.",
    };
  }

  if (/UPSC|IFS|FAST STREAM|FSOT|PSC/i.test(exam) || input.mode === "interview") {
    return {
      title: `${exam} Interview / personality (strict)`,
      standard:
        "Grade like a skeptical board: clarity of thought, balanced judgment, ethical awareness, concrete examples. Bluffing and jargon are exposed.",
      dimensions: SPEECH_COMMON,
      passHint: "One clear stance, two proofs, one limitation, one close.",
    };
  }

  return {
    title: "Competitive speaking — strict coach",
    standard:
      "No participation trophies. Empty or near-empty speeches score near zero. Scores must be justified by transcript evidence. Good extempore ≈ 50–65; excellent rare.",
    dimensions: SPEECH_COMMON,
    passHint: "Thesis → pillars → nuance → close, inside the clock.",
  };
}
