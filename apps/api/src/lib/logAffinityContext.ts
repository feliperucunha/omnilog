import { z } from "zod";

/** Mirrors `@geeklogs/shared` `LogAffinityContext`; validated before persisting JSON. */
export const logAffinityContextSchema = z
  .object({
    boardgames: z
      .object({
        playingTimeMinutes: z.number().int().min(0).max(999).nullable().optional(),
        playersMin: z.number().int().min(0).max(99).nullable().optional(),
        playersMax: z.number().int().min(0).max(99).nullable().optional(),
        minAge: z.number().int().min(0).max(99).nullable().optional(),
        averageWeight: z.number().min(0).max(5).nullable().optional(),
      })
      .strict()
      .optional(),
    books: z
      .object({
        subjects: z.array(z.string().min(1).max(120)).max(15).optional(),
        authors: z.array(z.string().min(1).max(120)).max(5).optional(),
        publisher: z.string().max(200).nullable().optional(),
        year: z.number().int().min(800).max(2100).nullable().optional(),
      })
      .strict()
      .optional(),
    manga: z
      .object({
        genres: z.array(z.string().min(1).max(80)).max(12).optional(),
        themes: z.array(z.string().min(1).max(80)).max(12).optional(),
        demographics: z.array(z.string().min(1).max(80)).max(6).optional(),
        serialization: z.string().max(200).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ParsedLogAffinityContext = z.infer<typeof logAffinityContextSchema>;

export function parseLogAffinityContextJson(json: string | null): ParsedLogAffinityContext | null {
  if (!json || json.trim() === "") return null;
  try {
    const raw = JSON.parse(json) as unknown;
    const parsed = logAffinityContextSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function stringifyLogAffinityContext(
  value: ParsedLogAffinityContext | null | undefined
): string | null {
  if (value == null) return null;
  const parsed = logAffinityContextSchema.safeParse(value);
  if (!parsed.success) return null;
  return JSON.stringify(parsed.data);
}
