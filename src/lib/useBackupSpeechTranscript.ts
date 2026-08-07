"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appendTranscriptChunk, sanitizeTranscript } from "@/lib/transcriptClean";

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((ev: SpeechRecEvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function getRecognizer(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * Live browser STT (desktop backup). Restarts carefully and de-dupes chunks —
 * mobile Chrome often re-emits the same phrase after every restart.
 */
export function useBackupSpeechTranscript() {
  const [live, setLive] = useState("");
  const liveRef = useRef("");
  const finalRef = useRef("");
  const recRef = useRef<SpeechRec | null>(null);
  const shouldRun = useRef(false);
  const lastResultAt = useRef(0);
  const watchdogRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const bootRef = useRef<() => void>(() => {});
  const restartingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (watchdogRef.current != null) {
      window.clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const setLiveBoth = useCallback((text: string) => {
    const cleaned = sanitizeTranscript(text);
    liveRef.current = cleaned;
    setLive(cleaned);
  }, []);

  const killRecognizer = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort?.();
    } catch {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const scheduleRestart = useCallback(
    (delayMs = 350) => {
      if (!shouldRun.current || restartingRef.current) return;
      if (restartTimerRef.current != null) return;
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (!shouldRun.current) return;
        restartingRef.current = true;
        // Keep committed finals only — do NOT fold interim/live back in
        // (that caused "data protection" × 5 after each restart).
        finalRef.current = sanitizeTranscript(finalRef.current);
        setLiveBoth(finalRef.current);
        bootRef.current();
        restartingRef.current = false;
      }, delayMs);
    },
    [setLiveBoth],
  );

  const bootRecognizer = useCallback(() => {
    if (!shouldRun.current) return;
    killRecognizer();

    const rec = getRecognizer();
    if (!rec) return;
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = "en-US";
    lastResultAt.current = Date.now();

    rec.onresult = (event) => {
      lastResultAt.current = Date.now();
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i]![0]!.transcript;
        if (event.results[i]!.isFinal) {
          finalRef.current = appendTranscriptChunk(finalRef.current, piece);
        } else {
          interim += piece;
        }
      }
      const interimClean = interim.replace(/\s+/g, " ").trim();
      // Don't show interim if it's already inside committed finals
      const showInterim =
        interimClean &&
        !finalRef.current.toLowerCase().endsWith(interimClean.toLowerCase()) &&
        !finalRef.current.toLowerCase().includes(` ${interimClean.toLowerCase()}`);
      setLiveBoth(
        showInterim
          ? `${finalRef.current} ${interimClean}`.trim()
          : finalRef.current,
      );
    };

    rec.onerror = (ev) => {
      if (!shouldRun.current) return;
      if (ev.error === "aborted" || ev.error === "not-allowed") return;
      // Ignore noisy no-speech loops — wait for watchdog instead of thrashing
      if (ev.error === "no-speech") return;
      scheduleRestart(500);
    };

    rec.onend = () => {
      if (!shouldRun.current) return;
      scheduleRestart(400);
    };

    try {
      rec.start();
    } catch {
      scheduleRestart(600);
    }
  }, [killRecognizer, scheduleRestart, setLiveBoth]);

  useEffect(() => {
    bootRef.current = bootRecognizer;
  }, [bootRecognizer]);

  const stop = useCallback(() => {
    shouldRun.current = false;
    clearTimers();
    killRecognizer();
  }, [clearTimers, killRecognizer]);

  const getFinal = useCallback(
    () => sanitizeTranscript(liveRef.current.trim() || finalRef.current),
    [],
  );

  const start = useCallback(() => {
    finalRef.current = "";
    setLiveBoth("");
    shouldRun.current = true;
    restartingRef.current = false;
    clearTimers();
    lastResultAt.current = Date.now();
    bootRecognizer();

    // Only restart if truly stalled (longer window — avoids mid-phrase thrash)
    watchdogRef.current = window.setInterval(() => {
      if (!shouldRun.current) return;
      if (Date.now() - lastResultAt.current > 12000) {
        scheduleRestart(0);
      }
    }, 2000);
  }, [bootRecognizer, clearTimers, scheduleRestart, setLiveBoth]);

  const reset = useCallback(() => {
    stop();
    finalRef.current = "";
    setLiveBoth("");
  }, [setLiveBoth, stop]);

  useEffect(() => () => stop(), [stop]);

  return { live, start, stop, reset, getFinal };
}
