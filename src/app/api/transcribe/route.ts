import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Optional cloud Whisper fallback for phones/iPads when browser STT fails.
 * Set WHISPER_API_KEY (+ optional WHISPER_API_URL / WHISPER_MODEL).
 * Compatible with OpenAI Audio Transcriptions API.
 */
export async function POST(req: Request) {
  const apiKey =
    process.env.WHISPER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.EVALUATOR_API_KEY ||
    "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server speech-to-text is not configured" },
      { status: 501 },
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size < 400) {
      return NextResponse.json({ error: "Missing audio" }, { status: 400 });
    }

    const upstream = new FormData();
    const name =
      file instanceof File && file.name ? file.name : "speech.webm";
    upstream.append("file", file, name);
    upstream.append(
      "model",
      process.env.WHISPER_MODEL || "whisper-1",
    );
    upstream.append("response_format", "json");
    upstream.append("language", "en");

    const base = (
      process.env.WHISPER_API_URL ||
      "https://api.openai.com/v1/audio/transcriptions"
    ).replace(/\/$/, "");

    const res = await fetch(base, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream transcription failed" },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { text?: string };
    const text = (data.text || "").replace(/\s+/g, " ").trim();
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
