const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_ATTEMPTS = 3;

export class GeminiUnavailableError extends Error {
  readonly code = "AI_UNAVAILABLE";
}

export class GeminiGenerationError extends Error {
  readonly code = "AI_GENERATION_FAILED";
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function resolveGeminiModel(): string {
  return (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL).replace(/^models\//, "");
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateGeminiJson(prompt: string): Promise<string> {
  if (!isGeminiConfigured()) throw new GeminiUnavailableError("Gemini is not configured on this server");
  const apiKey = process.env.GEMINI_API_KEY!.trim();
  const model = resolveGeminiModel();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1_000 * (attempt - 1));
        continue;
      }
      throw new GeminiGenerationError(
        `Gemini request failed: ${error instanceof Error ? error.message : "network error"}`
      );
    }

    if (response.status === 429) {
      const detail = (await response.text()).slice(0, 400);
      throw new GeminiGenerationError(`Gemini quota exceeded (429): ${detail}`);
    }
    if (response.status >= 500) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1_000 * attempt);
        continue;
      }
      const detail = (await response.text()).slice(0, 400);
      throw new GeminiGenerationError(`Gemini is temporarily unavailable (${response.status}): ${detail}`);
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 400);
      throw new GeminiGenerationError(`Gemini request failed (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text?.trim())
      .filter((part): part is string => Boolean(part))
      .join("\n")
      .trim();

    if (!text) throw new GeminiGenerationError("Gemini returned no content");
    return text;
  }

  throw new GeminiGenerationError("Gemini request failed");
}
