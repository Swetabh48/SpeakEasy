import type { PanelMember } from "@/lib/boardPanel";
import { followUpHints } from "@/lib/boardAgent/followup";
import { hashPick, type AgentTurn } from "@/lib/boardAgent/personas";
import type { CandidateProfile } from "@/lib/topics/board";

export function fallbackFollowUp(
  profile: CandidateProfile,
  persona: PanelMember,
  lastAnswer: string,
): string {
  const name = profile.name || "Candidate";
  const hints = followUpHints(lastAnswer);
  let snippet = lastAnswer.split(/\s+/).slice(0, 22).join(" ");
  if (lastAnswer.split(/\s+/).length > 22) snippet = `${snippet.replace(/[,.]$/, "")}…`;
  const seed = `${name}|fu|${persona.id}|${snippet.slice(0, 40)}`;

  const skeptic = [
    `Alright ${name}, forgive me — I am going to be a little difficult. You said, roughly, "${snippet}". A popular officer might do the opposite. In one clear reason, why are they wrong?`,
    `Hmm. That was neat. Too neat. Suppose your collector smiles and says, "Nice theory — do the opposite tomorrow." What do you say without sulking?`,
    `I hear you. Now the arrogant question: if your approach hurts someone you claim to protect, do you still hold it — yes or no, then why?`,
    `Let me tease this a bit. You sounded confident about "${snippet}". Where does that break on a chaotic Monday in the district — one concrete failure mode?`,
  ];
  const press = [
    `Thank you. Stay with that for a moment. You mentioned "${snippet}". What exactly would you do in the first hour, and who is helped or hurt?`,
    `Good, but that stayed general. Give us one decision — not a speech — and who lives with the consequences.`,
    `I noticed some hedging there. Pick a side cleanly: what is your call, and what do you trade away?`,
    `Connect that answer to something already on your DAF — hometown, optional, work, or a hobby. Don't leave it floating.`,
  ];
  const short = [
    `That was very brief, ${name}. Take thirty seconds more — one example from your own background, please.`,
    `We need a little more than a line. Walk us through your reasoning as if we were new to the file.`,
  ];
  const chair = [
    `Thank you. Just so we are clear — when you say "${snippet}", what is the first practical step you would actually take?`,
  ];

  let bank =
    persona.domain === "skeptic"
      ? skeptic
      : persona.domain === "chair-daf"
        ? [...chair, ...press]
        : press;
  if (hints.includes("answer_was_very_short")) bank = [...short, ...bank];
  return hashPick(seed, bank);
}

export function fallbackQuestion(
  profile: CandidateProfile,
  turns: AgentTurn[],
  persona: PanelMember,
  category: string,
): string {
  const name = profile.name || "Candidate";
  const state = profile.homeState || "your state";
  const hobbies = profile.hobbies || [];
  const optional = profile.optionalSubject || "";
  const branch = profile.engineeringBranch || "";
  const work = profile.workExperience || "";
  const track = profile.track || "upsc-cse";
  const degree = profile.education?.degree || "your degree";
  const boardN = turns.filter((t) => t.role === "board").length;
  const seed = `${name}|${state}|${boardN}|${persona.id}|${category}`;

  if (category === "welcome" || boardN === 0) {
    return hashPick(seed, [
      `Good morning, ${name}. Please, make yourself comfortable. To begin, introduce yourself in about two minutes — your education, your hometown in ${state}, and what brings you to this board today.`,
      `Welcome, ${name}. We will keep this conversational. Start with a short introduction: studies, any work, and why public service.`,
    ]);
  }

  if (persona.domain === "skeptic") {
    return hashPick(seed, [
      `Permit me a slightly rude question, ${name}. With your CV, why civil service — and not a job where success is measured every quarter?`,
      `I will play devil's advocate. Suppose the policy you like hurts a group you say you care about. Do you still support it? Say yes or no, then defend it in plain words.`,
      `Someone on another board once joked that candidates from ${state} oversell "ground reality". Smile if you like — then give one decision you took that actually cost you something.`,
    ]);
  }

  if (
    persona.domain === "subject" ||
    category === "optional-subject" ||
    category === "technical"
  ) {
    const bank: string[] = [];
    if (optional) {
      bank.push(
        `Thank you. I look after the subject side. You chose ${optional}. Tell us one field situation where that knowledge would stop a popular but wrong order.`,
        `About ${optional} — if a collector shrugs and says it is only bookish, how do you explain its use in under a minute, without jargon?`,
      );
    }
    if (branch || track === "psu-technical") {
      bank.push(
        `From ${branch || degree}: it is 2 a.m., an alarm trips, and the shift wants to bypass interlocks. What is your call, step by step?`,
        `Vendor is pushing, management wants speed. How do you say no on paper so you are not made the scapegoat later?`,
      );
    }
    if (bank.length) return hashPick(seed, bank);
  }

  if (
    persona.domain === "affairs-ethics" ||
    category === "current-affairs" ||
    category === "ethics"
  ) {
    return hashPick(seed, [
      `Picture this: tension in a district of ${state}, and your SDM freezes. What are your first three orders — simply, in order?`,
      `A minister's office wants a file cleared today. The rule says no. Walk us through the next hour without drama — what do you actually do?`,
      `A junior is being pressured to falsify a report. You sit in the middle of the hierarchy. What do you do by evening?`,
    ]);
  }

  if (persona.domain === "quiet" || category === "personality") {
    return hashPick(seed, [
      `I have been quiet, ${name}, so one personal question. What opinion on your DAF might this board dislike — and would you still defend it?`,
      `Softly asked: if money were the only scoreboard, why not the private sector? Give a real reason, not a slogan.`,
      `Tell us one failure that was genuinely your fault. No "team" cushion — we will not laugh.`,
    ]);
  }

  const soft: string[] = [
    `Thank you, that was helpful. You mentioned ${state}. Growing up there — what shaped how you think about administration? One concrete memory is enough.`,
    `Your degree is ${degree}. How has that training prepared you for an officer's day-to-day responsibilities?`,
  ];
  if (hobbies[0]) {
    soft.push(
      `I see ${hobbies[0]} on your DAF. Boards sometimes wonder if hobbies are decoration. In a few sentences, how do you actually pursue it, and what has it taught you?`,
    );
  }
  if (optional) {
    soft.push(
      `You took ${optional} as optional. What drew you to it, and how do you see it helping in the field?`,
    );
  }
  if (work && !["none", "n/a", "na", "nil"].includes(work.toLowerCase())) {
    soft.push(
      `About your work experience — summarise the role briefly, and one lesson you would carry into service.`,
    );
  }
  return hashPick(seed, soft);
}
