/**
 * Roles:
 *   - generate  → YOUR trained board brain (Modal EVALUATOR / HF / Ollama) asks questions
 *   - analyze   → Gemini supports (understand answer, pick move)
 *   - support   → Gemini only polishes / repairs a draft from YOUR model (never invents the topic)
 */

export type BoardLlmMeta = {
  source: "gemini" | "evaluator" | "ollama" | "none";
  model: string;
  /** True when Gemini polished a draft from your trained model */
  supported?: boolean;
};

export type BoardLlmOptions = {
  timeoutMs?: number;
  purpose?: "analyze" | "generate" | "support";
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

function geminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    undefined
  );
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
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
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

async function callGemini(
  system: string,
  user: string,
  temperature: number,
  timeoutMs: number,
): Promise<string> {
  const key = geminiApiKey();
  if (!key) return "";
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  try {
    const content = await chatCompletions(
      "https://generativelanguage.googleapis.com/v1beta/openai",
      model,
      key,
      system,
      user,
      temperature,
      timeoutMs,
    );
    if (content) {
      lastMeta = { source: "gemini", model, supported: true };
      return content;
    }
  } catch {
    /* empty */
  }
  return "";
}

async function callTrainedBrain(
  system: string,
  user: string,
  temperature: number,
  hostedTimeout: number,
  ollamaTimeout: number,
): Promise<string> {
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
      const base = customUrl.replace(/\/$/, "").replace(/\/v1$/, "");
      const content = await chatCompletions(
        `${base}/v1`,
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
        "https://router.huggingface.co/v1",
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
      /* empty */
    }
  }

  return "";
}

/**
 * Gemini support: polish a draft from YOUR trained model.
 * Must keep the same topic/intent — does not invent a new board question.
 */
export async function polishBoardDraft(
  draft: string,
  context: string,
): Promise<string> {
  const draftLine = draft.trim();
  if (!draftLine) return "";
  const system =
    "You support a UPSC mock board model. You are given a DRAFT question from that trained model. " +
    "Rewrite it in clear, spoken board-room English (1–3 sentences). " +
    "KEEP the same topic and intent. Fix garbled words using PROFILE context when obvious. " +
    "Do NOT invent a new topic. Do NOT add policy essays unrelated to the draft. " +
    "Return ONLY the spoken question text.";
  const user = `DRAFT_FROM_TRAINED_MODEL:\n${draftLine}\n\nCONTEXT:\n${context}`;
  const priorSource = lastMeta.source;
  const priorModel = lastMeta.model;
  const polished = await callGemini(system, user, 0.3, 12_000);
  if (!polished) return "";
  const line = polished.split("\n")[0]?.trim() || "";
  if (line) {
    lastMeta = {
      source:
        priorSource === "ollama" || priorSource === "evaluator"
          ? priorSource
          : "evaluator",
      model: priorModel || "speakeasy-board",
      supported: true,
    };
  }
  return line;
}

/**
 * - generate → YOUR mock-trained brain asks (Modal / HF / Ollama). Gemini does not author.
 * - analyze / support → Gemini understands / helps; never replaces your model as the questioner.
 */
export async function boardLlmChat(
  system: string,
  user: string,
  temperature = 0.55,
  options: BoardLlmOptions = {},
): Promise<string> {
  const purpose = options.purpose || "generate";
  const hostedTimeout =
    options.timeoutMs ?? (purpose === "generate" ? 28_000 : 8_000);
  const ollamaTimeout =
    options.timeoutMs ?? (purpose === "generate" ? 25_000 : 8_000);

  if (purpose === "analyze" || purpose === "support") {
    const gemini = await callGemini(system, user, temperature, hostedTimeout);
    if (gemini) return gemini;
    // Soft fallback: trained brain may still return usable JSON / text
    const trained = await callTrainedBrain(
      system,
      user,
      temperature,
      hostedTimeout,
      ollamaTimeout,
    );
    if (trained) return trained;
    lastMeta = { source: "none", model: "" };
    return "";
  }

  // generate: trained model is the questioner
  const trained = await callTrainedBrain(
    system,
    user,
    temperature,
    hostedTimeout,
    ollamaTimeout,
  );
  if (trained) return trained;

  lastMeta = { source: "none", model: "" };
  return "";
}
