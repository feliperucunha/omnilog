import type { SearchResult } from "@geeklogs/shared";
import { buildBookTagAffinityMaps } from "../lib/bookAffinity.js";
import { pickAffinitySearchQueries } from "../lib/boardGameAffinity.js";
import { searchBooks, type OpenLibrarySearchOptions } from "./openLibrary.js";
import { topUpFromPopular } from "../lib/searchRecommendationsMerge.js";
import type { BookLogForAffinity } from "../lib/bookAffinity.js";

const FALLBACK_QUERIES = ["fiction", "literature"];

export type BookRecommendationsOutcome = {
  results: SearchResult[];
  personalization: "from_logs" | "popular";
};

export async function fetchBookRecommendationsMerged(args: {
  logs: BookLogForAffinity[];
  exclude: Set<string>;
  maxResults: number;
  sort: string | undefined;
  maxSearchCalls?: number;
}): Promise<BookRecommendationsOutcome> {
  const { logs, exclude, maxResults, sort, maxSearchCalls = 2 } = args;

  const { scores, queryLabel } = buildBookTagAffinityMaps(logs);
  const hadPositiveAffinity = [...scores.values()].some((v) => v > 0.06);

  let queries = pickAffinitySearchQueries(scores, queryLabel, 6);
  if (queries.length === 0) {
    queries = [...FALLBACK_QUERIES];
  }
  queries = queries.slice(0, Math.max(1, maxSearchCalls));

  const byId = new Map<string, { row: SearchResult; rank: number }>();
  let queryIndex = 0;

  const olOpts: OpenLibrarySearchOptions | undefined = sort
    ? undefined
    : { openLibraryApiSort: "rating" };

  for (const q of queries) {
    if (byId.size >= maxResults) break;
    const batch = await searchBooks(q, sort, olOpts);
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

  results = await topUpFromPopular(
    results,
    () => searchBooks("novel", sort, olOpts),
    exclude,
    maxResults
  );

  return {
    results,
    personalization: hadPositiveAffinity ? "from_logs" : "popular",
  };
}
