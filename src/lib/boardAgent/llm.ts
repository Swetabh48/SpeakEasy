/** Board LLM: free hosted (EVALUATOR_*) → Ollama (speakeasy-board preferred) → empty. */

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
      signal: AbortSignal.timeout(3_000),
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
 * EVALUATOR_* (Groq / your host) → Hugging Face router (fine-tuned speakeasy-board) → Ollama → "".
 */
export async function boardLlmChat(
  system: string,
  user: string,
  temperature = 0.55,
  options: BoardLlmOptions = {},
): Promise<string> {
  const hostedTimeout = options.timeoutMs ?? (options.purpose === "generate" ? 20_000 : 12_000);
  const ollamaTimeout = options.timeoutMs ?? (options.purpose === "generate" ? 60_000 : 25_000);

  const customUrl = process.env.EVALUATOR_URL?.trim();
  const customModel = process.env.EVALUATOR_MODEL?.trim() || "llama-3.1-8b-instant";
  const ollamaUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
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

  // Free Hugging Face Inference (OpenAI-compatible router) — host your fine-tune here
  if (hfToken && !customUrl) {
    try {
      const content = await chatCompletions(
        "https://router.huggingface.co",
        hfModel,
        hfToken,
        system,
        user,
        temperature,
        hostedTimeout,
      );
      if (content) {
        lastMeta = { source: "evaluator", model: hfModel };
        return content;
      }
    } catch {
      /* fall through to Ollama */
    }
  }

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

  lastMeta = { source: "none", model: "" };
  return "";
}
