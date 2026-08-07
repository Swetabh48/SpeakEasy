"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
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

export function useSpeechTranscript() {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const finalRef = useRef("");
  const shouldRun = useRef(false);

  const stop = useCallback(() => {
    shouldRun.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    setError(null);
    finalRef.current = "";
    setTranscript("");
    const rec = getRecognizer();
    if (!rec) {
      setSupported(false);
      setError("Speech recognition not supported in this browser (try Chrome).");
      return;
    }
    setSupported(true);
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    shouldRun.current = true;

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i]![0]!.transcript;
        if (event.results[i]!.isFinal) {
          finalRef.current = `${finalRef.current} ${piece}`.trim();
        } else {
          interim += piece;
        }
      }
      setTranscript(`${finalRef.current} ${interim}`.trim());
    };

    rec.onerror = (ev) => {
      if (ev.error === "no-speech") return;
      setError(ev.error);
    };

    rec.onend = () => {
      if (shouldRun.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start speech recognition.");
      setListening(false);
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    finalRef.current = "";
    setTranscript("");
    setError(null);
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    transcript,
    listening,
    supported,
    error,
    start,
    stop,
    reset,
    setTranscript,
  };
}
