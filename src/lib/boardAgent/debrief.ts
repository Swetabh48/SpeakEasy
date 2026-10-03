import type { BoardMemory } from "@/lib/boardAgent/memory";
import { thinDafFields } from "@/lib/boardAgent/memory";
import type { AgentTurn } from "@/lib/boardAgent/personas";
import type { CandidateProfile } from "@/lib/topics/board";

const HEDGE_RE =
  /\b(i think|i feel|maybe|perhaps|sort of|kind of|basically|actually|you know|i mean|probably|possibly|somewhat)\b/gi;

export function buildDebrief(
  turns: AgentTurn[],
  violations: { kind?: string; atMs?: number }[],
  profile?: CandidateProfile | null,
  memory?: BoardMemory | null,
) {
  const boardQs = turns.filter((t) => t.role === "board");
  const answers = turns.filter((t) => t.role === "candidate");
  const pairs: { bq: AgentTurn; ans?: AgentTurn }[] = [];
  let ai = 0;
  for (const bq of boardQs) {
    const ans = answers[ai];
    if (ans) ai += 1;
    pairs.push({ bq, ans });
  }

  const notes: string[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const shortIdxs: number[] = [];

  pairs.forEach(({ bq, ans }, idx) => {
    const i = idx + 1;
    if (!ans) {
      notes.push(`Q${i} — no answer recorded.`);
      return;
    }
    const words = ans.text.split(/\s+/);
    const n = words.length;
    const hedges = (ans.text.match(HEDGE_RE) || []).length;
    const density = hedges / Math.max(1, n);
    if (n < 18) {
      shortIdxs.push(i);
      weaknesses.push(
        `Q${i} — one-line / very short answer (${n} words); boards usually want elaboration.`,
      );
    } else if (n > 180) {
      weaknesses.push(
        `Q${i} — long answer (${n} words); practice tighter structure (point → example → close).`,
      );
    }
    if (density >= 0.04 && hedges >= 3) {
      weaknesses.push(
        `Q${i} — high hedge density (~${hedges} hedges in ${n} words). Prefer clearer commitments.`,
      );
    }
    if (n >= 40 && hedges <= 1) {
      strengths.push(`Q${i} — reasonably developed answer with few hedges.`);
    }
    if (bq.isFollowUp) {
      notes.push(
        `Q${i} — cross-question from ${bq.speakerName || "panel"} (pressed previous answer).`,
      );
    }
  });

  dafCrossCheck(pairs, notes, weaknesses);

  const byCat: Record<string, number> = {};
  for (const { bq } of pairs) {
    const cat = bq.category || "uncategorized";
    byCat[cat] = (byCat[cat] || 0) + 1;
  }
  const categoryCoverage = Object.entries(byCat)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, count]) => `${cat}: ${count} question(s)`);

  if (shortIdxs.length) {
    notes.push(
      `Short answers on Q${shortIdxs.join(", Q")} — expand with one concrete example next time.`,
    );
  }

  if (memory) {
    const thin = thinDafFields(memory);
    if (thin.length) {
      notes.push(
        `DAF coverage still thin on: ${thin.join(", ")}. Expect the board to return here.`,
      );
    }
    if (memory.openThreads.length) {
      weaknesses.push(
        `Unfinished threads left open: ${memory.openThreads
          .slice(0, 3)
          .map((t) => t.topic)
          .join("; ")}.`,
      );
    }
    if (memory.claims.length >= 2) {
      strengths.push(
        `Panel captured ${memory.claims.length} concrete claims from your answers — good specificity footprint.`,
      );
    }
    notes.push(`Session pressure level ended at ${memory.pressureLevel.toFixed(2)}.`);
  }

  if (!weaknesses.length) {
    strengths.push(
      "No major length/hedge flags — keep grounding answers in DAF facts.",
    );
  }

  const kindCounts: Record<string, number> = {};
  for (const v of violations) {
    const k = String(v.kind || "unknown");
    kindCounts[k] = (kindCounts[k] || 0) + 1;
  }
  const disciplineNotes = Object.entries(kindCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, c]) => `${k.replace(/-/g, " ")}: ${c} time(s)`);
  if (!disciplineNotes.length) {
    disciplineNotes.push("No discipline events logged this session.");
  }

  return {
    candidateName: profile?.name || "Candidate",
    questionCount: boardQs.length,
    answerCount: answers.length,
    categoryCoverage,
    boardReport: {
      title: "Board Report",
      summary: `${boardQs.length} questions · ${answers.length} answers · ${pairs.filter((p) => p.bq.isFollowUp).length} follow-ups`,
      strengths: strengths.slice(0, 6).length
        ? strengths.slice(0, 6)
        : ["Session too short to judge strengths."],
      weaknesses: weaknesses.slice(0, 8).length
        ? weaknesses.slice(0, 8)
        : ["No automatic weakness flags."],
      notes: notes.length
        ? notes
        : ["Complete a longer session for denser transcript feedback."],
    },
    disciplineReport: {
      title: "Discipline Report",
      eventCount: violations.length,
      notes: disciplineNotes,
    },
  };
}

function dafCrossCheck(
  pairs: { bq: AgentTurn; ans?: AgentTurn }[],
  notes: string[],
  weaknesses: string[],
) {
  const texts = pairs.map(
    ({ bq, ans }) => `${bq.text} ${ans?.text || ""}`.toLowerCase(),
  );
  if (texts.length < 3) return;
  const optQs = texts
    .map((t, i) => (t.includes("optional") || t.includes("subject") ? i + 1 : 0))
    .filter(Boolean);
  const hobbyQs = texts
    .map((t, i) => (t.includes("hobby") || t.includes("hobbies") ? i + 1 : 0))
    .filter(Boolean);
  if (optQs.length && hobbyQs.length && texts.length >= 4) {
    const laterStart = Math.max(optQs[optQs.length - 1]!, hobbyQs[hobbyQs.length - 1]!) + 1;
    let bridged = false;
    for (let i = laterStart; i <= texts.length; i++) {
      const t = texts[i - 1]!;
      if (
        (t.includes("optional") || t.includes("subject")) &&
        (t.includes("hobby") || t.includes("interest") || t.includes("passion"))
      ) {
        bridged = true;
        break;
      }
    }
    if (!bridged) {
      weaknesses.push(
        `Q${optQs[0]} / Q${hobbyQs[0]} — optional/subject and hobby came up separately; you never connected them in a later answer (boards often test DAF coherence).`,
      );
    }
  }
  const workQs = texts
    .map((t, i) =>
      t.includes("work") || t.includes("job") || t.includes("office") ? i + 1 : 0,
    )
    .filter(Boolean);
  const ethicsQs = texts
    .map((t, i) =>
      t.includes("ethic") ||
      t.includes("corrupt") ||
      t.includes("integrity") ||
      t.includes("bribe")
        ? i + 1
        : 0,
    )
    .filter(Boolean);
  if (
    workQs.length &&
    ethicsQs.length &&
    ethicsQs[ethicsQs.length - 1]! > workQs[0]!
  ) {
    const eth = texts[ethicsQs[ethicsQs.length - 1]! - 1]!;
    if (!eth.includes("work") && !eth.includes("job") && !eth.includes("office")) {
      notes.push(
        `Q${ethicsQs[ethicsQs.length - 1]} — ethics question after work discussion (Q${workQs[0]}); tying the dilemma to your stated experience usually scores better.`,
      );
    }
  }
}
