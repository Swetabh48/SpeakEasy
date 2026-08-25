"use client";

import type { FaceDetector } from "@mediapipe/tasks-vision";

export type FaceSnapshot = {
  faceCount: number;
  /** Largest face box area as fraction of frame (0–1) */
  largestFaceRatio: number;
  lookingAway: boolean;
};

export function emptyFaceSnapshot(): FaceSnapshot {
  return { faceCount: 0, largestFaceRatio: 0, lookingAway: false };
}

let detectorPromise: Promise<FaceDetector | null> | null = null;

async function getDetector(): Promise<FaceDetector | null> {
  if (typeof window === "undefined") return null;
  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );
        return vision.FaceDetector.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.55,
        });
      } catch {
        try {
          const vision = await import("@mediapipe/tasks-vision");
          const fileset = await vision.FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
          );
          return vision.FaceDetector.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            minDetectionConfidence: 0.55,
          });
        } catch {
          return null;
        }
      }
    })();
  }
  return detectorPromise;
}

export async function analyzeFace(
  video: HTMLVideoElement,
  timestampMs: number,
): Promise<FaceSnapshot> {
  if (!video.videoWidth || !video.videoHeight) return emptyFaceSnapshot();
  const detector = await getDetector();
  if (!detector) return emptyFaceSnapshot();

  try {
    const result = detector.detectForVideo(video, timestampMs);
    const detections = result.detections || [];
    const frameArea = video.videoWidth * video.videoHeight;
    let largest = 0;
    for (const d of detections) {
      const box = d.boundingBox;
      if (!box) continue;
      const area = Math.max(0, box.width) * Math.max(0, box.height);
      largest = Math.max(largest, area / frameArea);
    }
    return {
      faceCount: detections.length,
      largestFaceRatio: largest,
      lookingAway: false,
    };
  } catch {
    return emptyFaceSnapshot();
  }
}
