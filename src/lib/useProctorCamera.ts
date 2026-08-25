"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeFace } from "@/lib/proctor/faceMonitor";
import type { ProctorStatus, ViolationEvent, ViolationKind } from "@/lib/proctor/types";

/**
 * Camera + MediaPipe face box + tab/fullscreen discipline.
 * Violations live in React state so the UI updates immediately.
 */
export function useProctorCamera(enabled: boolean) {
  const [status, setStatus] = useState<ProctorStatus>({
    faces: 0,
    lookingAway: false,
    tooClose: false,
    active: false,
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const startedAt = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPush = useRef<Record<string, number>>({});
  const onViolationRef = useRef<((kind: ViolationKind) => void) | null>(null);

  const push = useCallback((kind: ViolationKind) => {
    if (!startedAt.current) return;
    const now = Date.now();
    const gap = kind === "too-close" || kind === "no-face" ? 4000 : 1500;
    if (now - (lastPush.current[kind] || 0) < gap) return;
    lastPush.current[kind] = now;
    setViolations((prev) => [
      ...prev,
      { kind, atMs: now - startedAt.current },
    ]);
    onViolationRef.current?.(kind);
  }, []);

  const setOnViolation = useCallback((fn: ((kind: ViolationKind) => void) | null) => {
    onViolationRef.current = fn;
  }, []);

  const getViolations = useCallback(() => violations, [violations]);

  const clearViolations = useCallback(() => {
    setViolations([]);
    lastPush.current = {};
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
      setStatus({
        faces: 0,
        lookingAway: false,
        tooClose: false,
        active: false,
      });
      return;
    }

    let cancelled = false;
    let localStream: MediaStream | null = null;
    let raf = 0;
    startedAt.current = Date.now();
    setViolations([]);
    lastPush.current = {};

    const onVis = () => {
      if (document.hidden) push("tab-switch");
    };
    const onBlur = () => push("tab-switch");
    const onFs = () => {
      if (!document.fullscreenElement) push("fullscreen-exit");
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);

    (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = media;
        setStream(media);
        setStatus({
          faces: 1,
          lookingAway: false,
          tooClose: false,
          active: true,
        });
      } catch {
        setStatus({
          faces: 0,
          lookingAway: false,
          tooClose: false,
          active: false,
        });
        push("no-face");
      }
    })();

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        const snap = await analyzeFace(video, performance.now());
        const tooClose = snap.faceCount === 1 && snap.largestFaceRatio > 0.28;
        setStatus((s) => ({
          ...s,
          faces: snap.faceCount,
          tooClose,
          active: true,
        }));
        if (snap.faceCount === 0) push("no-face");
        else if (snap.faceCount > 1) push("multi-face");
        else if (tooClose) push("too-close");
      }
      raf = window.setTimeout(() => void tick(), 700) as unknown as number;
    };
    raf = window.setTimeout(() => void tick(), 900) as unknown as number;

    return () => {
      cancelled = true;
      window.clearTimeout(raf);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
      localStream?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [enabled, push]);

  const attachVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && stream) {
        el.srcObject = stream;
        void el.play().catch(() => undefined);
      }
    },
    [stream],
  );

  return {
    status,
    stream,
    violations,
    attachVideo,
    getViolations,
    clearViolations,
    pushViolation: push,
    setOnViolation,
  };
}
