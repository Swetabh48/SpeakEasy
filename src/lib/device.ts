/** Coarse mobile / tablet detection for STT strategy. */
export function isMobileLike(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
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
