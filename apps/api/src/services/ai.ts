import { generateGeminiJson, isGeminiConfigured } from "./gemini.js";
import { generateGroqJson, isGroqConfigured } from "./groq.js";

export class AiUnavailableError extends Error {
  readonly code = "AI_UNAVAILABLE";
}

export class AiGenerationError extends Error {
  readonly code = "AI_GENERATION_FAILED";
}

export function isAiConfigured(): boolean {
  return isGeminiConfigured() || isGroqConfigured();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function generateAiJson(prompt: string): Promise<string> {
  const failures: string[] = [];

  if (isGeminiConfigured()) {
    try {
      return await generateGeminiJson(prompt);
    } catch (error) {
      failures.push(`Gemini: ${errorMessage(error)}`);
    }
  }

  if (isGroqConfigured()) {
    try {
      return await generateGroqJson(prompt);
    } catch (error) {
      failures.push(`Groq: ${errorMessage(error)}`);
    }
  }

  if (!isAiConfigured()) {
    throw new AiUnavailableError("AI is not configured on this server");
  }
  throw new AiGenerationError(`AI generation failed. ${failures.join(" | ")}`.slice(0, 1000));
}
