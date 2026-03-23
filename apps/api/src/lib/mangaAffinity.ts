import { parseGenresJson } from "./serializeLog.js";
import { parseLogAffinityContextJson } from "./logAffinityContext.js";

export type MangaLogForAffinity = {
  genres: string | null;
  affinityContext: string | null;
  grade: number | null;
  status: string | null;
};

function normalizeTagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * MAL genres, themes, demographics, serialization from logs + `affinityContext.manga`.
 */
export function buildMangaTagAffinityMaps(logs: MangaLogForAffinity[]): {
  scores: Map<string, number>;
  queryLabel: Map<string, string>;
} {
  const scores = new Map<string, number>();
  const queryLabel = new Map<string, string>();

  for (const log of logs) {
    const fromGenres = parseGenresJson(log.genres) ?? [];
    const ctx = parseLogAffinityContextJson(log.affinityContext ?? null)?.manga;
    const tags = [
      ...fromGenres,
      ...(ctx?.genres ?? []),
      ...(ctx?.themes ?? []),
      ...(ctx?.demographics ?? []),
    ];
    if (ctx?.serialization?.trim()) tags.push(ctx.serialization.trim());
    if (tags.length === 0) continue;

    let delta: number;
    if (log.grade != null && log.grade >= 0 && log.grade <= 10) {
      delta = (log.grade - 5) / 5;
      if (log.grade >= 8) delta *= 1.12;
      if (log.grade <= 3) delta *= 1.15;
    } else {
      delta = 0.22;
    }

    for (const raw of tags) {
      const key = normalizeTagKey(raw);
      if (!key) continue;
      scores.set(key, (scores.get(key) ?? 0) + delta);
      const prev = queryLabel.get(key);
      const trimmed = raw.trim();
      if (!prev || trimmed.length > prev.length) queryLabel.set(key, trimmed);
    }
  }

  return { scores, queryLabel };
}
