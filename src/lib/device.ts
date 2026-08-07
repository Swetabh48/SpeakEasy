/** Device helpers for speech capture strategy. */

export function isAppleTouch(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
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
 * - record: MediaRecorder + Moonshine/Whisper (phones/tablets — Web Speech repeats badly)
 * - both: recorder + in-browser ASR + live caption backup (desktop)
 */
export type SttStrategy = "captions" | "record" | "both";

export function getSttStrategy(): SttStrategy {
  // All phones/tablets: record + on-device ASR.
  // Web Speech on mobile restarts constantly and duplicates phrases ("data protection" × 5),
  // then skips real transcription and scores that junk instantly.
  if (isMobileLike()) return "record";
  return "both";
}
