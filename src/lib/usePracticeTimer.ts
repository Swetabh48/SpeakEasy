"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TimerPhase = "idle" | "prep" | "speak" | "done";

export function usePracticeTimer(prepSec: number, speakSec: number) {
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [remaining, setRemaining] = useState(0);
  const phaseRef = useRef<TimerPhase>("idle");
  const remainingRef = useRef(0);
  const prepRef = useRef(prepSec);
  const speakRef = useRef(speakSec);
  const intervalRef = useRef<number | null>(null);

  prepRef.current = prepSec;
  speakRef.current = speakSec;

  const clear = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const setPhaseBoth = useCallback((p: TimerPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const setRemainingBoth = useCallback((n: number) => {
    remainingRef.current = n;
    setRemaining(n);
  }, []);

  const run = useCallback(() => {
    clear();
    intervalRef.current = window.setInterval(() => {
      const next = remainingRef.current - 1;
      if (next > 0) {
        setRemainingBoth(next);
        return;
      }

      if (phaseRef.current === "prep") {
        setPhaseBoth("speak");
        setRemainingBoth(speakRef.current);
        return;
      }

      clear();
      setRemainingBoth(0);
      setPhaseBoth("done");
    }, 1000);
  }, [clear, setPhaseBoth, setRemainingBoth]);

  const startPrep = useCallback(() => {
    setPhaseBoth("prep");
    setRemainingBoth(prepRef.current);
    run();
  }, [run, setPhaseBoth, setRemainingBoth]);

  const startSpeakOnly = useCallback(() => {
    setPhaseBoth("speak");
    setRemainingBoth(speakRef.current);
    run();
  }, [run, setPhaseBoth, setRemainingBoth]);

  const skipToSpeak = useCallback(() => {
    setPhaseBoth("speak");
    setRemainingBoth(speakRef.current);
    run();
  }, [run, setPhaseBoth, setRemainingBoth]);

  const reset = useCallback(() => {
    clear();
    setPhaseBoth("idle");
    setRemainingBoth(0);
  }, [clear, setPhaseBoth, setRemainingBoth]);

  useEffect(() => clear, [clear]);

  return {
    phase,
    remaining,
    startPrep,
    startSpeakOnly,
    skipToSpeak,
    reset,
  };
}
