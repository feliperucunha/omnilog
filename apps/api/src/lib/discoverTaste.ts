import { z } from "zod";
import type {
  DiscoverCategoryTaste,
  DiscoverTasteSnapshot,
  MediaType,
} from "@geeklogs/shared";

const aiTasteCategorySchema = z.object({
  lines: z.array(z.string().trim().min(1).max(500)).min(1).max(6),
  beyond: z
    .array(
      z.object({
        id: z.string().min(1).max(512),
        title: z.string().min(1).max(300),
        note: z.union([z.string(), z.null()]).optional().transform((value) => value ?? ""),
      })
    )
    .max(12),
});

export type AiTasteCategory = z.infer<typeof aiTasteCategorySchema>;

const plannedTasteItemSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  title: z.string(),
  status: z.string(),
});

const beyondTasteItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string(),
});

const tasteChartSchema = z.object({
  label: z.string(),
  count: z.number(),
});

const categoryTasteSchema = z.object({
  lines: z.array(z.string()),
  charts: z.array(tasteChartSchema),
  planned: z.array(plannedTasteItemSchema),
  beyond: z.array(beyondTasteItemSchema),
});

const storedSnapshotSchema = z.object({
  refreshedAt: z.union([z.string(), z.null()]),
  categories: z.record(z.string(), categoryTasteSchema),
});

export function parseStoredDiscoverTasteSnapshot(value: unknown): DiscoverTasteSnapshot | null {
  const parsed = storedSnapshotSchema.safeParse(value);
  if (!parsed.success) return null;
  const categories: DiscoverTasteSnapshot["categories"] = {};
  for (const [key, category] of Object.entries(parsed.data.categories)) {
    categories[key as MediaType] = category as DiscoverCategoryTaste;
  }
  return { refreshedAt: parsed.data.refreshedAt, categories };
}

export interface DiscoverTasteCandidate {
  id: string;
  title: string;
  subtitle?: string | null;
  genres?: string[] | null;
  year?: string | null;
  score?: number | null;
}

export interface DiscoverTastePromptCategory {
  mediaType: MediaType;
  summary: Record<string, unknown>;
  logs: Array<Record<string, unknown>>;
  candidates: DiscoverTasteCandidate[];
}

export class DiscoverTasteParseError extends Error {
  readonly code = "AI_GENERATION_FAILED";
}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new DiscoverTasteParseError("AI did not return valid JSON");
  }
}

export function buildDiscoverTastePrompt(input: {
  locale: string;
  categories: DiscoverTastePromptCategory[];
}): string {
  const instructions = [
    "You analyze a personal media logging library and write a concise taste profile.",
    `Respond in the user's language: ${input.locale}.`,
    "Return only a JSON object. No markdown, no prose outside JSON.",
    "Use one key per media type supplied, exactly as given.",
    "Each value must be an object with: lines (2-4 short specific insights in the user's language, no markdown), beyond (up to 8 items).",
    "For beyond, choose only titles from that media type's candidates. Copy id and title exactly from the candidate. Write a one-sentence note explaining why it fits the user's logged taste.",
    "Never invent a title, id, genre, or fact. If candidates are empty, return an empty beyond array.",
    "Base insights on each category's summary and recent log sample: grades, statuses, genres, mechanics, reviews, and other fields. The summary covers the full library; the sample is recent examples. Be specific and varied; do not repeat raw database labels when a natural sentence works.",
  ].join("\n");

  return `${instructions}\n\nInput:\n${JSON.stringify(input.categories, null, 2)}`;
}

export function parseDiscoverTasteResponse(
  text: string,
  mediaTypes: MediaType[],
  allowedBeyondIds: Partial<Record<MediaType, Set<string>>>
): Partial<Record<MediaType, AiTasteCategory>> {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new DiscoverTasteParseError("AI returned an unexpected JSON shape");
  }

  const record = raw as Record<string, unknown>;
  const result: Partial<Record<MediaType, AiTasteCategory>> = {};

  for (const mediaType of mediaTypes) {
    const key = Object.keys(record).find((candidate) => candidate.toLowerCase() === mediaType.toLowerCase());
    const parsed = aiTasteCategorySchema.safeParse(key ? record[key] : undefined);
    if (!parsed.success) {
      throw new DiscoverTasteParseError(`AI returned an invalid ${mediaType} taste profile`);
    }

    const allowed = allowedBeyondIds[mediaType] ?? new Set<string>();
    result[mediaType] = {
      lines: parsed.data.lines.slice(0, 4),
      beyond: parsed.data.beyond
        .filter((item) => allowed.has(item.id))
        .slice(0, 8)
        .map((item) => ({ id: item.id, title: item.title, note: item.note.slice(0, 500) })),
    };
  }

  return result;
}
