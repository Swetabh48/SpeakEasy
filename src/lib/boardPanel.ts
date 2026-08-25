export type PanelMemberId =
  | "chair"
  | "member-a"
  | "member-b"
  | "member-c"
  | "member-d";

export type PanelDomain =
  | "chair-daf"
  | "subject"
  | "affairs-ethics"
  | "quiet"
  | "skeptic";

export type PanelMember = {
  id: PanelMemberId;
  name: string;
  role: string;
  domain: PanelDomain;
  /** Short blurb shown in UI / used for voice tuning */
  persona: string;
  initials: string;
  color: string;
  voiceHint: "deep" | "warm" | "crisp" | "soft" | "firm";
  /** Calmer chair vs sharper skeptic — fed into Web Speech rate/pitch */
  pitch: number;
  rate: number;
};

/** Five-member board — IDs must match backend `app/agent/personas.py`. */
export const BOARD_PANEL: PanelMember[] = [
  {
    id: "chair",
    name: "Dr. Mehta",
    role: "Chairperson",
    domain: "chair-daf",
    persona: "Calm, clear, conversational — opens/closes and DAF questions.",
    initials: "DM",
    color: "#E8A849",
    voiceHint: "firm",
    pitch: 0.88,
    rate: 0.82,
  },
  {
    id: "member-a",
    name: "Ms. Iyer",
    role: "Subject member",
    domain: "subject",
    persona: "Sharp but fair on optional / branch — states the scene clearly.",
    initials: "SI",
    color: "#5EEAD4",
    voiceHint: "crisp",
    pitch: 1.08,
    rate: 0.9,
  },
  {
    id: "member-b",
    name: "Prof. Khan",
    role: "Generalist",
    domain: "affairs-ethics",
    persona: "Ethics & affairs as short stories, occasional dry humour.",
    initials: "AK",
    color: "#A78BFA",
    voiceHint: "deep",
    pitch: 0.8,
    rate: 0.85,
  },
  {
    id: "member-c",
    name: "Mr. Rao",
    role: "Member",
    domain: "quiet",
    persona: "Mostly quiet; soft-spoken personal questions when he jumps in.",
    initials: "PR",
    color: "#F472B6",
    voiceHint: "warm",
    pitch: 0.97,
    rate: 0.88,
  },
  {
    id: "member-d",
    name: "Dr. Sen",
    role: "Skeptic",
    domain: "skeptic",
    persona: "Arrogant, witty, sometimes funny — always clear, never cryptic.",
    initials: "NS",
    color: "#34D399",
    voiceHint: "soft",
    pitch: 1.06,
    rate: 0.94,
  },
];

export function getPanelMember(id: string | null | undefined): PanelMember {
  return BOARD_PANEL.find((m) => m.id === id) ?? BOARD_PANEL[0]!;
}

/** Fallback only — prefer speakerId from the API. */
export function pickSpeaker(turnIndex: number): PanelMember {
  return BOARD_PANEL[turnIndex % BOARD_PANEL.length]!;
}
