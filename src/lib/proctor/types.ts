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

export type ProctorStatus = {
  faces: number;
  lookingAway: boolean;
  /** Face fills too much of frame — candidate too close / leaning in */
  tooClose: boolean;
  active: boolean;
};
