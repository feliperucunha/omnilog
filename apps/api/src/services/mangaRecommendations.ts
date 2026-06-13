import type { AnimeMangaTitleLanguage, SearchResult } from "@geeklogs/shared";
import { DEFAULT_ANIME_MANGA_TITLE_LANGUAGE } from "@geeklogs/shared";
import { buildMangaTagAffinityMaps, type MangaLogForAffinity } from "../lib/mangaAffinity.js";
import { pickAffinitySearchQueries } from "../lib/boardGameAffinity.js";
import { searchManga, getTopMangaByScore } from "./jikan.js";
import { topUpFromPopular } from "../lib/searchRecommendationsMerge.js";

const FALLBACK_QUERIES = ["seinen", "manga"];

export type MangaRecommendationsOutcome = {
  results: SearchResult[];
  personalization: "from_logs" | "popular";
};

export async function fetchMangaRecommendationsMerged(args: {
  logs: MangaLogForAffinity[];
  exclude: Set<string>;
  maxResults: number;
  sort: string | undefined;
  maxSearchCalls?: number;
  titlePreference?: AnimeMangaTitleLanguage;
}): Promise<MangaRecommendationsOutcome> {
  const { logs, exclude, maxResults, sort, maxSearchCalls = 2, titlePreference = DEFAULT_ANIME_MANGA_TITLE_LANGUAGE } = args;

  const { scores, queryLabel } = buildMangaTagAffinityMaps(logs);
  const hadPositiveAffinity = [...scores.values()].some((v) => v > 0.06);

  let queries = pickAffinitySearchQueries(scores, queryLabel, 6);
  if (queries.length === 0) {
    queries = [...FALLBACK_QUERIES];
  }
  queries = queries.slice(0, Math.max(1, maxSearchCalls));

  const byId = new Map<string, { row: SearchResult; rank: number }>();
  let queryIndex = 0;

  for (const q of queries) {
    if (byId.size >= maxResults) break;
    const batch = await searchManga(q, sort ?? "score_desc", titlePreference);
    const rankBase = queryIndex * 1000;
    let i = 0;
    for (const row of batch) {
      if (exclude.has(row.id) || byId.has(row.id)) {
        i += 1;
        continue;
      }
      byId.set(row.id, { row, rank: rankBase + i });
      i += 1;
      if (byId.size >= maxResults) break;
    }
    queryIndex += 1;
  }

  let results = [...byId.values()]
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.row)
    .slice(0, maxResults);

  results = await topUpFromPopular(results, () => getTopMangaByScore(maxResults, titlePreference), exclude, maxResults);

  return {
    results,
    personalization: hadPositiveAffinity ? "from_logs" : "popular",
  };
}
