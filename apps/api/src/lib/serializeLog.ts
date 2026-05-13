import { decodeHtmlEntities } from "@geeklogs/shared";
import { parseLogAffinityContextJson } from "./logAffinityContext.js";

/**
 * Parse genres JSON string from Log.genres to string[] for API response.
 */
export function parseGenresJson(json: string | null): string[] | null {
  if (!json || json.trim() === "") return null;
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .slice(0, 20)
      .map((x) => decodeHtmlEntities(x));
  } catch {
    return null;
  }
}

/** Board-game mechanics stored like genres (JSON string array). */
export function parseMechanicsJson(json: string | null): string[] | null {
  return parseGenresJson(json);
}

export function serializeLog<
  T extends {
    mediaType: string;
    externalId: string;
    title: string;
    review?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    genres?: string | null;
    mechanics?: string | null;
    affinityContext?: string | null;
  },
>(log: T) {
  return {
    ...log,
    title: decodeHtmlEntities(log.title),
    review: log.review != null ? decodeHtmlEntities(log.review) : null,
    startedAt: log.startedAt?.toISOString() ?? null,
    completedAt: log.completedAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    genres: parseGenresJson(log.genres ?? null),
    mechanics: parseMechanicsJson(log.mechanics ?? null),
    affinityContext: parseLogAffinityContextJson(log.affinityContext ?? null),
  };
}
