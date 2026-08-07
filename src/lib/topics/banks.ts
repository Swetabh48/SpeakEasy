/** Combinatorial banks powering 10M+ unique speech topics. */

import type { Category } from "./fields";
export type { Category } from "./fields";
export { CATEGORIES, SUBJECTS, categoryLabel } from "./fields";

export const MODES = [
  "impromptu",
  "debate",
  "interview",
  "ielts",
  "group",
  "pitch",
  "essay",
  "deep-research",
] as const;

export type Mode = (typeof MODES)[number];

export const DIFFICULTIES = ["warm-up", "standard", "challenge", "exam-hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const REGIONS = [
  "India",
  "Pakistan",
  "Bangladesh",
  "Sri Lanka",
  "Nepal",
  "China",
  "Japan",
  "South Korea",
  "Singapore",
  "Indonesia",
  "Malaysia",
  "Philippines",
  "Vietnam",
  "Thailand",
  "United States",
  "Canada",
  "Mexico",
  "Brazil",
  "Argentina",
  "Chile",
  "United Kingdom",
  "France",
  "Germany",
  "Italy",
  "Spain",
  "Netherlands",
  "Sweden",
  "Norway",
  "Poland",
  "Ukraine",
  "Russia",
  "Turkey",
  "Saudi Arabia",
  "UAE",
  "Israel",
  "Egypt",
  "Nigeria",
  "Kenya",
  "South Africa",
  "Ghana",
  "Ethiopia",
  "Australia",
  "New Zealand",
  "Southeast Asia",
  "the European Union",
  "Sub-Saharan Africa",
  "Latin America",
  "the Middle East",
  "the Global South",
  "the Asia-Pacific region",
  "Scandinavia",
  "the Caribbean",
  "Central Asia",
  "the Sahel",
  "the Arctic",
  "major cities worldwide",
  "rural communities",
  "coastal economies",
  "island nations",
  "emerging markets",
  "developed economies",
  "border regions",
  "megacities",
  "university campuses",
  "industrial hubs",
];

export const ANGLES = [
  "from an ethics lens",
  "with economic consequences in mind",
  "for the next generation",
  "through a historical comparison",
  "from a youth perspective",
  "as a policymaker would",
  "considering rural voices",
  "with gender equity in focus",
  "from a business competition angle",
  "looking at unintended consequences",
  "comparing short-term vs long-term gains",
  "through the lens of human rights",
  "as a skeptic of conventional wisdom",
  "using a cost-benefit framework",
  "for national competitiveness",
  "with climate urgency in mind",
  "as someone who has lived abroad",
  "from a teacher's viewpoint",
  "as a future employer",
  "emphasizing practical feasibility",
  "highlighting cultural sensitivities",
  "with democratic values at stake",
  "from an innovation-first stance",
  "prioritizing the most vulnerable",
  "without relying on clichÃ©s",
  "using evidence over anecdotes",
  "as if advising a cabinet minister",
  "for a university debate final",
  "as a TED-style talk opener",
  "for a job interview panel",
  "in under two minutes of clarity",
  "while acknowledging counterarguments",
  "connecting local and global effects",
  "from a scientific literacy angle",
  "as a community organizer",
  "with media literacy in mind",
  "as a parent of teenagers",
  "from an investor's risk view",
  "for a Model UN session",
  "as a crisis communications lead",
];

export const STAKEHOLDERS = [
  "students",
  "teachers",
  "parents",
  "entrepreneurs",
  "civil servants",
  "journalists",
  "doctors",
  "farmers",
  "factory workers",
  "artists",
  "athletes",
  "retirees",
  "migrants",
  "indigenous communities",
  "tech founders",
  "small shop owners",
  "nurses",
  "soldiers",
  "city mayors",
  "researchers",
  "activists",
  "investors",
  "tour guides",
  "bus drivers",
  "software engineers",
  "climate scientists",
  "judges",
  "diplomats",
  "freelancers",
  "caregivers",
  "first-time voters",
  "university deans",
  "union leaders",
  "start-up employees",
  "rural youth",
  "urban professionals",
];

export const TEMPLATES: Record<
  Mode,
  { id: string; pattern: string; categories?: Category[]; difficultyBias?: Difficulty[] }[]
> = {
  impromptu: [
    {
      id: "should",
      pattern:
        "Should {region} prioritize {subject}? Argue {angle}.",
    },
    {
      id: "agree",
      pattern:
        "\"{subject} is overrated.\" To what extent do you agree? Frame your answer {angle}.",
    },
    {
      id: "proscons",
      pattern:
        "What are the strongest arguments for and against {subject} in {region}?",
    },
    {
      id: "change",
      pattern:
        "If you could change one thing about {subject} affecting {stakeholders} in {region}, what would it be and why?",
    },
    {
      id: "explain",
      pattern:
        "Explain {subject} to a curious 16-year-old in {region}, then take a clear stance {angle}.",
    },
    {
      id: "future",
      pattern:
        "In ten years, how will {subject} reshape life in {region}? Speak {angle}.",
    },
    {
      id: "story",
      pattern:
        "Tell a short personal or hypothetical story that reveals a truth about {subject}, then generalize for {region}.",
    },
    {
      id: "priority",
      pattern:
        "If {region} had limited resources, where should {subject} rank among national priorities?",
    },
    {
      id: "myth",
      pattern:
        "What is the biggest myth about {subject} circulating among {stakeholders}? Debunk it {angle}.",
    },
    {
      id: "moment",
      pattern:
        "Describe a turning point related to {subject} that {region} cannot ignore, and what must happen next.",
    },
  ],
  debate: [
    {
      id: "motion-this-house",
      pattern:
        "This House believes that {region} should aggressively pursue policy on {subject}. Speak as Proposition {angle}.",
    },
    {
      id: "motion-opp",
      pattern:
        "This House believes that {region} should aggressively pursue policy on {subject}. Speak as Opposition {angle}.",
    },
    {
      id: "ban",
      pattern:
        "Motion: Ban practices that worsen {subject} in {region}. Construct a three-point case.",
    },
    {
      id: "tax",
      pattern:
        "Motion: Tax or regulate {subject} heavily to protect {stakeholders}. Defend or defeat the motion.",
    },
    {
      id: "moral",
      pattern:
        "Motion: Moral progress demands reform of {subject} worldwide, starting with {region}.",
    },
    {
      id: "clash",
      pattern:
        "Clash: liberty of {stakeholders} versus public interest regarding {subject} in {region}. Choose a side.",
    },
    {
      id: "bp",
      pattern:
        "British Parliamentary style: define and weigh {subject} as it plays out in {region}, {angle}.",
    },
    {
      id: "rebuttal",
      pattern:
        "Your opponents say {subject} is a non-issue in {region}. Deliver a devastating rebuttal {angle}.",
    },
  ],
  interview: [
    {
      id: "tell-me",
      pattern:
        "Interview prompt: Tell me about a time you formed a strong opinion on {subject}. What would you recommend for {region}?",
    },
    {
      id: "why-you",
      pattern:
        "Why should a team facing challenges around {subject} hire someone who thinks like you? Answer {angle}.",
    },
    {
      id: "pressure",
      pattern:
        "Under pressure: You have 90 seconds to brief a CEO on {subject} affecting {stakeholders} in {region}.",
    },
    {
      id: "conflict",
      pattern:
        "Describe how you would handle conflict between {stakeholders} over {subject} in {region}.",
    },
    {
      id: "leadership",
      pattern:
        "Leadership scenario: Your organization must respond to {subject}. Outline your first 30 days {angle}.",
    },
    {
      id: "weakness",
      pattern:
        "What blind spots do leaders often have about {subject}? How would you overcome them for work in {region}?",
    },
    {
      id: "values",
      pattern:
        "Which professional values matter most when dealing with {subject}? Illustrate with a stance for {region}.",
    },
  ],
  ielts: [
    {
      id: "part2-describe",
      pattern:
        "IELTS-style: Describe an issue related to {subject} that matters in {region}. You should say what it is, why it matters, who it affects, and explain {angle}.",
    },
    {
      id: "part3-compare",
      pattern:
        "IELTS discussion: How does {subject} differ between cities and villages in {region}? Explore {angle}.",
    },
    {
      id: "part3-future",
      pattern:
        "IELTS discussion: Do you think {subject} will improve for {stakeholders} in {region} over the next decade? Why?",
    },
    {
      id: "agree-disagree",
      pattern:
        "Essay-to-speech: Some people think {subject} should be left to markets; others want government control in {region}. Discuss both views and give your opinion.",
    },
    {
      id: "advantages",
      pattern:
        "What are the advantages and disadvantages of rapid change around {subject} for {stakeholders} in {region}?",
    },
    {
      id: "opinion",
      pattern:
        "To what extent do you agree that {region} is handling {subject} better than peer countries? Speak {angle}.",
    },
  ],
  group: [
    {
      id: "gd-opening",
      pattern:
        "Group discussion opener: Introduce {subject} as it affects {region}, set the agenda, and invite others {angle}.",
    },
    {
      id: "gd-moderate",
      pattern:
        "As GD moderator: Summarize competing views on {subject} among {stakeholders} in {region} and propose a consensus path.",
    },
    {
      id: "gd-disrupt",
      pattern:
        "Someone derailed the discussion on {subject}. Politely redirect the group to actionable ideas for {region}.",
    },
    {
      id: "gd-close",
      pattern:
        "Close a 10-minute GD on {subject} with three takeaways for policymakers in {region}.",
    },
    {
      id: "case",
      pattern:
        "Case study circle: {region} faces a crisis linked to {subject}. Assign roles to {stakeholders} and recommend a plan.",
    },
    {
      id: "priority-matrix",
      pattern:
        "Team task: Rank interventions on {subject} for {region} by impact and feasibility. Defend your ranking {angle}.",
    },
  ],
  pitch: [
    {
      id: "startup",
      pattern:
        "Pitch a solution to {subject} that could scale in {region}. Speak as if to investors, {angle}.",
    },
    {
      id: "policy-pitch",
      pattern:
        "Pitch a 3-point policy package on {subject} to the cabinet of {region}.",
    },
    {
      id: "ngo",
      pattern:
        "Pitch an NGO campaign about {subject} that mobilizes {stakeholders} across {region}.",
    },
    {
      id: "product",
      pattern:
        "Pitch a product or platform that reframes {subject} for everyday {stakeholders} in {region}.",
    },
    {
      id: "grant",
      pattern:
        "You have 2 minutes to win a grant for research or action on {subject} in {region}. Go.",
    },
  ],
  essay: [
    {
      id: "title",
      pattern: "{subject}",
    },
    {
      id: "discuss",
      pattern: "{subject}",
    },
  ],
  "deep-research": [
    {
      id: "brief",
      pattern: "{subject}",
    },
  ],
};

/** Secondary flavor hooks to explode combinatorial space without repeating wording. */
export const FLAVORS = [
  "Keep jargon minimal.",
  "Use one vivid example.",
  "Open with a surprising fact.",
  "End with a call to action.",
  "Challenge a popular slogan.",
  "Contrast two generations.",
  "Reference a recent headline without naming celebrities.",
  "Include a rhetorical question.",
  "Acknowledge the strongest counterpoint mid-speech.",
  "Use a before-and-after structure.",
  "Speak as if the room is skeptical.",
  "Make it memorable for a marking rubric.",
  "Prioritize clarity over flourish.",
  "Bring in a comparative country example.",
  "Anchor on fairness.",
  "Anchor on efficiency.",
  "Anchor on dignity.",
  "Anchor on innovation.",
  "Keep emotion controlled but present.",
  "Sound boardroom-ready.",
  "Sound classroom-ready.",
  "Sound stage-ready.",
  "Avoid hedging too much.",
  "Define one key term early.",
  "Use the rule of three.",
];

/** Topic shapes from one word → multi-sentence prompts. */
export const LENGTH_PATTERNS = [
  { id: "word", weight: 1, pattern: "{subject}" },
  { id: "two-word", weight: 1, pattern: "{subject}?" },
  { id: "phrase", weight: 2, pattern: "{subject} in {region}" },
  { id: "five-words", weight: 2, pattern: "The future of {subject}" },
  { id: "short-q", weight: 3, pattern: "Is {subject} inevitable?" },
  { id: "short-should", weight: 3, pattern: "Should {region} rethink {subject}?" },
  { id: "medium", weight: 4, pattern: "Speak on {subject} affecting {stakeholders} in {region}." },
  {
    id: "medium-angle",
    weight: 4,
    pattern: "Make a clear case on {subject} {angle}.",
  },
  {
    id: "long",
    weight: 3,
    pattern:
      "Discuss {subject} in {region}. Then explain what {stakeholders} should demand next.",
  },
  {
    id: "long-two",
    weight: 3,
    pattern:
      "\"{subject}\" divides opinion in {region}. Present both sides, then take a stand {angle}.",
  },
];

export const EXAM_PATTERNS = [
  "{exam}: Speak on {theme} with a {focus}.",
  "{exam} prompt — {theme}. Frame it for {region}.",
  "{theme}. ({exam} · {focus})",
  "For {exam}: Why does {theme} matter to {stakeholders} in {region}?",
  "{exam} viva: Defend a position on {theme} using a {focus}.",
  "One-liner for {exam}: {theme}",
  "{theme}?",
  "Board question ({exam}): Evaluate {theme} in light of {focus}.",
  "{exam} essay-to-speech: {theme} is reshaping {region}. Agree or disagree.",
  "Extempore ({exam}): {theme} —  {focus}.",
  "Case nugget for {exam}: {stakeholders} collide over {theme} in {region}. Advise.",
  "{exam}: Connect {theme} to current affairs in {region}.",
  "Quick take ({exam}): {theme}",
  "Two-sentence drill ({exam}): Define {theme}. Then argue one reform using {focus}.",
  "{exam} ethics slant: {theme} creates a dilemma for {stakeholders}. Resolve it.",
  "Panel ({exam}): \"{theme}\" — respond {angle}.",
  "{exam} GD seed: {theme} versus competing priorities in {region}.",
  "Interview ({exam}): Tell us your view on {theme}. Use a {focus}.",
];

export const SITUATION_VARIANTS = [
  "today",
  "this decade",
  "after the next election",
  "in a fiscal crunch",
  "under social media glare",
  "with imperfect data",
  "for first-time voters",
  "in a coalition era",
  "amid rapid urbanization",
  "during a climate summer",
  "when trust in institutions is low",
  "with youth unemployment high",
  "in a multipolar world",
  "after a major scandal",
  "with AI accelerating everything",
  "when budgets are political",
  "for the marginalized first",
  "without utopian assumptions",
  "comparing peer countries",
  "from a district collector's desk",
  "from a startup founder's lens",
  "as a teacher would explain",
  "as a diplomat would brief",
  "with one concrete metric",
  "rejecting false binaries",
  "naming trade-offs honestly",
  "in under ninety seconds",
  "as if marked by a strict examiner",
  "with a memorable closing line",
  "before a skeptical audience",
  "using local examples only",
  "avoiding buzzwords",
  "balancing rights and duties",
  "linking policy to lived experience",
  "acknowledging uncertainty",
  "prioritizing feasibility",
  "emphasizing dignity",
  "stress-testing assumptions",
  "mapping winners and losers",
  "seeing the second-order effects",
  "for a broadcast debate",
  "for a closed-door board",
  "for a campus competition",
  "for a scholarship panel",
  "for a Model UN caucus",
  "for a police board interview",
  "for a medical ethics station",
  "for a consulting case room",
];
