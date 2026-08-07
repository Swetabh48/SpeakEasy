"use client";

/**
 * Optional server fallback: POST audio to /api/transcribe
 * (OpenAI-compatible Whisper endpoint when WHISPER_API_KEY is set).
 */
export async function transcribeViaServer(
  blob: Blob,
): Promise<{ text: string; ok: boolean }> {
  try {
    const form = new FormData();
    const ext = blob.type.includes("mp4")
      ? "mp4"
      : blob.type.includes("ogg")
        ? "ogg"
        : "webm";
    form.append("file", blob, `speech.${ext}`);
    const res = await fetch("/api/transcribe", {
      method: "POST",
      body: form,
    });
    if (res.status === 501) return { text: "", ok: false };
    if (!res.ok) return { text: "", ok: false };
    const data = (await res.json()) as { text?: string };
    const text = (data.text || "").replace(/\s+/g, " ").trim();
    return { text, ok: Boolean(text) };
  } catch {
    return { text: "", ok: false };
  }
}
