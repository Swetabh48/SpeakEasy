/** Device helpers for speech capture strategy. */

export function isAppleTouch(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ often reports as Mac with touch
  try {
    return (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    );
  } catch {
    return false;
  }
}

/** Coarse mobile / tablet detection. */
export function isMobileLike(): boolean {
  if (typeof window === "undefined") return false;
  if (isAppleTouch()) return true;
  const ua = navigator.userAgent || "";
  if (/Android|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  try {
    return (
      navigator.maxTouchPoints > 1 &&
      window.matchMedia("(pointer: coarse)").matches
    );
  } catch {
    return false;
  }
}

export function hasSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * How to capture speech for scoring:
 * - captions: Web Speech only (Android Chrome — mic conflict with recorder)
 * - record: MediaRecorder + Whisper (/server STT) — iPhone/iPad
 * - both: recorder + Whisper + live caption backup — desktop
 */
export type SttStrategy = "captions" | "record" | "both";

export function getSttStrategy(): SttStrategy {
  if (isAppleTouch()) return "record";
  if (isMobileLike() && hasSpeechRecognition()) return "captions";
  return "both";
}
