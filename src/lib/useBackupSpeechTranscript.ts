"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 * Live browser STT while recording.
 * Chrome often stops mid-session; we recreate the recognizer and keep a rolling text buffer.
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
    liveRef.current = text;
    setLive(text);
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
    (delayMs = 220) => {
      if (!shouldRun.current) return;
      if (restartTimerRef.current != null) return;
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (!shouldRun.current) return;
        // Keep unfinished interim captions across restarts
        const kept = liveRef.current.trim();
        if (kept) finalRef.current = kept;
        bootRef.current();
      }, delayMs);
    },
    [],
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
          finalRef.current = `${finalRef.current} ${piece}`.trim();
        } else {
          interim += piece;
        }
      }
      setLiveBoth(`${finalRef.current} ${interim}`.trim());
    };

    rec.onerror = (ev) => {
      if (!shouldRun.current) return;
      if (ev.error === "aborted" || ev.error === "not-allowed") return;
      // no-speech / network / service-not-allowed / etc. — reopen stream
      scheduleRestart(280);
    };

    rec.onend = () => {
      if (!shouldRun.current) return;
      scheduleRestart(180);
    };

    try {
      rec.start();
    } catch {
      scheduleRestart(400);
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
    () => (liveRef.current.trim() || finalRef.current).trim(),
    [],
  );

  const start = useCallback(() => {
    finalRef.current = "";
    setLiveBoth("");
    shouldRun.current = true;
    clearTimers();
    lastResultAt.current = Date.now();
    bootRecognizer();

    // If captions freeze while you're still talking, force a fresh recognizer
    watchdogRef.current = window.setInterval(() => {
      if (!shouldRun.current) return;
      if (Date.now() - lastResultAt.current > 4500) {
        scheduleRestart(0);
      }
    }, 1200);
  }, [bootRecognizer, clearTimers, scheduleRestart, setLiveBoth]);

  const reset = useCallback(() => {
    stop();
    finalRef.current = "";
    setLiveBoth("");
  }, [setLiveBoth, stop]);

  useEffect(() => () => stop(), [stop]);

  return { live, start, stop, reset, getFinal };
}
