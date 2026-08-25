export type ServiceTrack = "upsc-cse" | "ies-ese" | "ifs" | "psu-technical";

export type CandidateProfile = {
  name: string;
  homeState: string;
  education: { degree: string; institution: string; year: number };
  optionalSubject?: string;
  engineeringBranch?: string;
  workExperience?: string;
  hobbies: string[];
  servicePreferences: string[];
  track: ServiceTrack;
  /** Optional text extracted from uploaded DAF/application PDF */
  dafUploadNotes?: string;
};

export type BoardTurn = {
  role: "board" | "candidate";
  text: string;
  timestampMs: number;
  speakerId?: string;
  speakerName?: string;
  category?: string;
  isFollowUp?: boolean;
};

export type ViolationKind =
  | "no-face"
  | "multi-face"
  | "gaze-away"
  | "head-turned"
  | "too-close"
  | "tab-switch"
  | "fullscreen-exit"
  | "phone-detected"
  | "conduct-abuse";

export type ViolationEvent = { kind: ViolationKind; atMs: number };

export type ToolTrace = {
  toolName: string;
  query?: string | null;
  resultSnippet?: string | null;
  usedInQuestion?: boolean;
};

export const SERVICE_TRACKS: { id: ServiceTrack; label: string }[] = [
  { id: "upsc-cse", label: "UPSC CSE Personality Test" },
  { id: "ies-ese", label: "IES / ESE Personality Test" },
  { id: "ifs", label: "IFS Personality Test" },
  { id: "psu-technical", label: "PSU / Technical Viva" },
];

export function trackLabel(track: ServiceTrack): string {
  return SERVICE_TRACKS.find((t) => t.id === track)?.label ?? track;
}
