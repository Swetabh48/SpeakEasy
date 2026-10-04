/** Board LLM: free hosted (EVALUATOR_*) → optional Ollama → empty (corpus/banks). */

export type BoardLlmMeta = {
  source: "evaluator" | "ollama" | "none";
  model: string;
};

export type BoardLlmOptions = {
  timeoutMs?: number;
  /** Prefer longer waits for local generation turns */
  purpose?: "analyze" | "generate";
};

let lastMeta: BoardLlmMeta = { source: "none", model: "" };

export function getLastBoardLlmMeta(): BoardLlmMeta {
  return lastMeta;
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  let raw = text.trim();
  if (raw.includes("```")) {
    const parts = raw.split("```");
    for (const p of parts) {
      let chunk = p.trim();
      if (chunk.startsWith("json")) chunk = chunk.slice(4).trim();
      if (chunk.startsWith("{")) {
        raw = chunk;
        break;
      }
    }
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Ollama only when useful. Never probe 127.0.0.1 on Vercel — that was hanging
 * board turns until the serverless function was killed (UI stuck on "preparing").
 */
function resolveOllamaBaseUrl(): string | null {
  const explicit = process.env.OLLAMA_BASE_URL?.trim();
  if (explicit) {
    if (process.env.VERCEL && /127\.0\.0\.1|localhost/i.test(explicit)) {
      return null;
    }
    return explicit;
  }
  if (process.env.VERCEL) return null;
  return "http://127.0.0.1:11434";
}

async function chatCompletions(
  baseUrl: string,
  model: string,
  apiKey: string | undefined,
  system: string,
  user: string,
  temperature: number,
  timeoutMs: number,
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function ollamaChat(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
  temperature: number,
  timeoutMs: number,
): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() || "";
}

async function ollamaHasModel(baseUrl: string, name: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { models?: { name?: string }[] };
    const models = data.models || [];
    const want = name.toLowerCase();
    return models.some((m) => {
      const n = (m.name || "").toLowerCase();
      return n === want || n.startsWith(`${want}:`) || n.startsWith(want);
    });
  } catch {
    return false;
  }
}

async function resolveOllamaModel(baseUrl: string): Promise<string> {
  const configured = process.env.OLLAMA_MODEL?.trim();
  if (configured && (await ollamaHasModel(baseUrl, configured))) return configured;
  if (await ollamaHasModel(baseUrl, "speakeasy-board")) return "speakeasy-board";
  if (configured) return configured;
  return "llama3.1:latest";
}

/**
 * Free hosted OpenAI-compatible:
 * EVALUATOR_* → Hugging Face router (optional) → Ollama (local / explicit) → "".
 */
export async function boardLlmChat(
  system: string,
  user: string,
  temperature = 0.55,
  options: BoardLlmOptions = {},
): Promise<string> {
  // Keep under Vercel maxDuration (60s) so corpus fallback always runs.
  const hostedTimeout =
    options.timeoutMs ??
    (options.purpose === "generate" ? 28_000 : 8_000);
  const ollamaTimeout =
    options.timeoutMs ??
    (options.purpose === "generate" ? 25_000 : 8_000);

  const customUrl = process.env.EVALUATOR_URL?.trim();
  const customModel = process.env.EVALUATOR_MODEL?.trim() || "speakeasy-board";
  const ollamaUrl = resolveOllamaBaseUrl();
  const hfToken =
    process.env.HF_TOKEN?.trim() ||
    process.env.HUGGINGFACE_HUB_TOKEN?.trim() ||
    process.env.EVALUATOR_API_KEY?.trim();
  const hfModel =
    process.env.HF_BOARD_MODEL?.trim() ||
    process.env.EVALUATOR_MODEL?.trim() ||
    "meta-llama/Meta-Llama-3.1-8B-Instruct";

  if (customUrl) {
    try {
      const content = await chatCompletions(
        customUrl,
        customModel,
        process.env.EVALUATOR_API_KEY,
        system,
        user,
        temperature,
        hostedTimeout,
      );
      if (content) {
        lastMeta = { source: "evaluator", model: customModel };
        return content;
      }
    } catch {
      /* fall through */
    }
  }

  if (hfToken && !customUrl) {
    try {
      const content = await chatCompletions(
        "https://router.huggingface.co",
        hfModel,
        hfToken,
        system,
        user,
        temperature,
        Math.min(hostedTimeout, 20_000),
      );
      if (content) {
        lastMeta = { source: "evaluator", model: hfModel };
        return content;
      }
    } catch {
      /* fall through */
    }
  }

  if (ollamaUrl) {
    try {
      const model = await resolveOllamaModel(ollamaUrl);
      const content = await ollamaChat(
        ollamaUrl,
        model,
        system,
        user,
        temperature,
        ollamaTimeout,
      );
      if (content) {
        lastMeta = { source: "ollama", model };
        return content;
      }
    } catch {
      /* corpus / banks */
    }
  }

  lastMeta = { source: "none", model: "" };
  return "";
}
