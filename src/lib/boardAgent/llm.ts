/** Optional LLM for board questions on Vercel (EVALUATOR_*) or local Ollama. */
export async function boardLlmChat(
  system: string,
  user: string,
  temperature = 0.55,
): Promise<string> {
  const customUrl = process.env.EVALUATOR_URL?.trim();
  const customModel = process.env.EVALUATOR_MODEL?.trim() || "speakeasy-examiner";
  const ollamaUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const ollamaModel = process.env.OLLAMA_MODEL?.trim() || "llama3.1:latest";

  if (customUrl) {
    try {
      const res = await fetch(`${customUrl.replace(/\/$/, "")}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.EVALUATOR_API_KEY
            ? { Authorization: `Bearer ${process.env.EVALUATOR_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          model: customModel,
          temperature,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        return data.choices?.[0]?.message?.content?.trim() || "";
      }
    } catch {
      /* fall through */
    }
  }

  // Local Ollama only works when Next runs on the same machine as Ollama
  try {
    const res = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        options: { temperature },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        message?: { content?: string };
      };
      return data.message?.content?.trim() || "";
    }
  } catch {
    /* fall through to banks */
  }
  return "";
}
