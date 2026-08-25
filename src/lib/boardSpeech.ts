"use client";

import type { PanelMember, PanelMemberId } from "@/lib/boardPanel";

const VOICE_CACHE = new Map<string, SpeechSynthesisVoice | null>();

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

/** Prefer Indian English OS voices when installed (cannot clone real UPSC panelists). */
function scoreVoice(v: SpeechSynthesisVoice, preferFemale: boolean): number {
  let s = 0;
  const name = v.name.toLowerCase();
  const lang = v.lang.toLowerCase();
  if (lang.startsWith("en-in")) s += 50;
  if (/india|indian|neerja|heera|ravi|prabhat|hindi/i.test(name)) s += 40;
  if (lang.startsWith("en-gb")) s += 12;
  if (lang.startsWith("en")) s += 5;
  if (preferFemale && /female|zira|susan|hazel|neerja|heera|samantha|karen|moira/i.test(name))
    s += 20;
  if (!preferFemale && /male|david|mark|ravi|prabhat|daniel|george|fred/i.test(name)) s += 20;
  // Neural / natural labels when Windows exposes them
  if (/neural|natural|premium|online/i.test(name)) s += 8;
  return s;
}

/** Stable per-member voice pick so each panelist sounds different. */
export function pickVoiceForMember(member: PanelMember): SpeechSynthesisVoice | null {
  if (VOICE_CACHE.has(member.id)) return VOICE_CACHE.get(member.id)!;

  const voices = loadVoices();
  if (!voices.length) return null;

  const preferFemale =
    member.voiceHint === "soft" || member.voiceHint === "crisp";

  const ranked = [...voices].sort(
    (a, b) => scoreVoice(b, preferFemale) - scoreVoice(a, preferFemale),
  );

  const order: PanelMemberId[] = [
    "chair",
    "member-a",
    "member-b",
    "member-c",
    "member-d",
  ];
  const idx = Math.max(0, order.indexOf(member.id));

  // Spread across top Indian/English candidates so members don't all sound identical
  const top = ranked.slice(0, Math.min(8, ranked.length));
  const chosen = top[idx % top.length] || ranked[0]!;

  VOICE_CACHE.set(member.id, chosen);
  return chosen;
}

export function speakAsMember(
  text: string,
  member: PanelMember,
  onEnd?: () => void,
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();

  const run = () => {
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoiceForMember(member);
    if (voice) utter.voice = voice;
    // Persona pacing: chair calmer, skeptic slightly sharper
    let rate = member.rate;
    let pitch = member.pitch;
    if (member.domain === "chair-daf") {
      rate = Math.min(rate, 0.84);
      pitch = Math.min(pitch, 0.92);
    } else if (member.domain === "skeptic") {
      rate = Math.min(0.95, Math.max(rate, 0.9));
      pitch = Math.max(pitch, 1.02);
    } else if (member.domain === "subject") {
      rate = Math.min(0.92, rate);
    }
    utter.pitch = pitch;
    utter.rate = Math.min(0.95, rate);
    utter.volume = 1;
    utter.onend = () => onEnd?.();
    utter.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utter);
  };

  if (loadVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      VOICE_CACHE.clear();
      run();
    };
  } else {
    run();
  }
}

/** Short spoken discipline warning from a stern panel member. */
export function speakDisciplineWarning(
  kind: string,
  member: PanelMember,
): void {
  const lines: Record<string, string> = {
    "too-close":
      "Candidate, please sit back properly. Maintain a respectful distance from the camera and sit upright.",
    "no-face":
      "Candidate, we cannot see your face. Please return to the frame immediately.",
    "multi-face":
      "Only the candidate should be visible. Please ensure no one else is in the camera frame.",
    "tab-switch":
      "Candidate, do not leave this window. Switching tabs during the board is not permitted.",
    "fullscreen-exit":
      "Remain in fullscreen for the duration of this interview. Return to fullscreen now.",
    "gaze-away": "Please look toward the board while answering.",
    "head-turned": "Face the panel, candidate.",
    "phone-detected": "Mobile phones are not allowed during this interview.",
    "conduct-abuse":
      "That language is unacceptable. Compose yourself immediately.",
  };
  const text =
    lines[kind] ||
    "Candidate, maintain proper board-room conduct.";
  speakAsMember(text, member);
}

export function stopBoardSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export async function requestBoardFullscreen(
  el?: HTMLElement | null,
): Promise<boolean> {
  try {
    const target = el || document.documentElement;
    if (!document.fullscreenElement) {
      await target.requestFullscreen?.();
    }
    return Boolean(document.fullscreenElement);
  } catch {
    return false;
  }
}

export async function exitBoardFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}
