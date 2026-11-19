const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export class GroqGenerationError extends Error {
  readonly code = "AI_GENERATION_FAILED";
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function resolveGroqModel(): string {
  return (process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL).replace(/^models\//, "");
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function generateGroqJson(prompt: string): Promise<string> {
  if (!isGroqConfigured()) throw new GroqGenerationError("Groq is not configured on this server");
  const apiKey = process.env.GROQ_API_KEY!.trim();
  const model = resolveGroqModel();

  let response: Response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    throw new GroqGenerationError(
      `Groq request failed: ${error instanceof Error ? error.message : "network error"}`
    );
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new GroqGenerationError(`Groq request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as GroqResponse;
  const text = data.choices
    ?.map((choice) => choice.message?.content?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n")
    .trim();

  if (!text) throw new GroqGenerationError("Groq returned no content");
  return text;
}
