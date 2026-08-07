"use client";

type AsrPipeline = (
  audio: Float32Array | string | URL | Blob,
  options?: Record<string, unknown>,
) => Promise<unknown>;

type WhisperDtype = "fp32" | "fp16" | "q8";

const pipelines = new Map<string, Promise<AsrPipeline>>();

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext || w.webkitAudioContext || null;
}

async function getPipeline(
  model: string,
  dtype: WhisperDtype,
): Promise<AsrPipeline> {
  const key = `${model}:${dtype}`;
  if (!pipelines.has(key)) {
    pipelines.set(
      key,
      (async () => {
        const { pipeline, env } = await import("@huggingface/transformers");
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        // Prefer WASM on mobile / constrained GPUs — more reliable than webgpu
        return (await pipeline("automatic-speech-recognition", model, {
          dtype,
          device: "wasm",
        })) as AsrPipeline;
      })(),
    );
  }
  return pipelines.get(key)!;
}

/** Decode blob then resample to 16 kHz mono. */
async function blobToFloat32_16k(blob: Blob): Promise<Float32Array> {
  const AC = getAudioContextCtor();
  if (!AC) throw new Error("No AudioContext");

  const buffer = await blob.arrayBuffer();
  const ctx = new AC();
  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    // decodeAudioData may detach the buffer — pass a copy
    const decoded = await ctx.decodeAudioData(buffer.slice(0));
    const mixed = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < mixed.length; i++) {
        mixed[i]! += data[i]! / decoded.numberOfChannels;
      }
    }
    if (decoded.sampleRate === 16000) return mixed;
    const ratio = decoded.sampleRate / 16000;
    const newLen = Math.max(1, Math.round(mixed.length / ratio));
    const out = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      out[i] = mixed[Math.min(mixed.length - 1, Math.floor(i * ratio))]!;
    }
    return out;
  } finally {
    await ctx.close();
  }
}

function extractText(result: unknown): string {
  if (typeof result === "string") return result;
  if (Array.isArray(result)) {
    return result.map((r: { text?: string }) => r.text || "").join(" ");
  }
  if (result && typeof result === "object" && "text" in result) {
    return String((result as { text: string }).text || "");
  }
  return "";
}

// Mobile-first: tiny models only. Avoid q8 first (known onnx scale bugs on some builds).
const ATTEMPTS: { model: string; dtype: WhisperDtype }[] = [
  { model: "Xenova/whisper-tiny.en", dtype: "fp32" },
  { model: "Xenova/whisper-tiny.en", dtype: "fp16" },
  { model: "Xenova/whisper-tiny.en", dtype: "q8" },
];

/**
 * Transcribe a recorded audio blob.
 * Tries multiple model settings; returns "" on total failure (never throws tech errors to UI).
 */
export async function transcribeWithWhisper(
  blob: Blob,
  onStatus?: (msg: string) => void,
): Promise<{ text: string; ok: boolean }> {
  if (!blob || blob.size < 800) return { text: "", ok: false };

  let audio: Float32Array;
  try {
    onStatus?.("Preparing your recording…");
    audio = await blobToFloat32_16k(blob);
  } catch {
    return { text: "", ok: false };
  }
  if (audio.length < 1600) return { text: "", ok: false };

  for (const attempt of ATTEMPTS) {
    try {
      onStatus?.("Transcribing your speech…");
      const asr = await getPipeline(attempt.model, attempt.dtype);
      const result = await asr(audio, {
        chunk_length_s: 20,
        stride_length_s: 4,
        return_timestamps: false,
        language: "english",
        task: "transcribe",
      });
      const text = extractText(result).replace(/\s+/g, " ").trim();
      if (text) return { text, ok: true };
    } catch {
      pipelines.delete(`${attempt.model}:${attempt.dtype}`);
    }
  }

  return { text: "", ok: false };
}
