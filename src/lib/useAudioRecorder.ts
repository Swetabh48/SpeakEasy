"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "recorded" | "denied" | "unsupported";

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const stopResolver = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanupUrl = useCallback(() => {
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAudioBlob(null);
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    try {
      cleanupUrl();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setDurationMs(Date.now() - startedAtRef.current);
        setState("recorded");
        stopTracks();
        stopResolver.current?.(blob);
        stopResolver.current = null;
      };
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start(250);
      setState("recording");
    } catch {
      setState("denied");
    }
  }, [cleanupUrl, stopTracks]);

  const stop = useCallback((): Promise<Blob | null> => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      return new Promise((resolve) => {
        stopResolver.current = resolve;
        rec.stop();
      });
    }
    stopTracks();
    setState((s) => (s === "recording" ? "idle" : s));
    return Promise.resolve(audioBlob);
  }, [audioBlob, stopTracks]);

  const reset = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopTracks();
    cleanupUrl();
    setDurationMs(0);
    setState("idle");
  }, [cleanupUrl, stopTracks]);

  useEffect(() => {
    return () => {
      stopTracks();
      cleanupUrl();
    };
  }, [cleanupUrl, stopTracks]);

  return { state, audioUrl, audioBlob, durationMs, start, stop, reset };
}
