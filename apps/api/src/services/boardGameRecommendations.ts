import type { SearchResult } from "@geeklogs/shared";
import {
  buildTagAffinityMaps,
  pickAffinitySearchQueries,
  type BoardGameLogForAffinity,
} from "../lib/boardGameAffinity.js";
import { searchBoardGames } from "./bgg.js";
import { searchBoardGamesLudopedia } from "./ludopedia.js";

export type { BoardGameLogForAffinity };

const FALLBACK_QUERIES = ["strategy", "family"];

type SearchBatch =
  | { results: SearchResult[] }
  | { results: []; requiresApiKey: string; link: string; tutorial: string };

type SearchFn = (q: string) => Promise<SearchBatch>;

export type BoardGameRecommendationsOutcome =
  | {
      results: SearchResult[];
      personalization: "from_logs" | "popular";
    }
  | {
      results: [];
      requiresApiKey: "bgg" | "ludopedia";
      link: string;
      tutorial: string;
    };

function normalizeQueryKey(q: string): string {
  return q.trim().toLowerCase();
}

/**
 * At most `maxSearchCalls` provider searches (each BGG/Ludopedia search uses its normal flow).
 * Merges, dedupes, excludes logged ids; earlier query batches rank earlier in the list.
 */
export async function fetchBoardGameRecommendationsMerged(args: {
  logs: BoardGameLogForAffinity[];
  exclude: Set<string>;
  maxResults: number;
  provider: "bgg" | "ludopedia";
  apiToken: string | null | undefined;
  sort: string | undefined;
  bggMeta: { link: string; tutorial: string };
  ludopediaMeta: { link: string; tutorial: string };
  /** Keep small: each call is a full search round-trip. */
  maxSearchCalls?: number;
}): Promise<BoardGameRecommendationsOutcome> {
  const {
    logs,
    exclude,
    maxResults,
    provider,
    apiToken,
    sort,
    bggMeta,
    ludopediaMeta,
    maxSearchCalls = 2,
  } = args;

  const { scores, queryLabel } = buildTagAffinityMaps(logs);
  const hadPositiveAffinity = [...scores.values()].some((v) => v > 0.06);

  let affinityQueries = pickAffinitySearchQueries(scores, queryLabel, 6);
  affinityQueries = affinityQueries.slice(0, Math.max(1, maxSearchCalls));

  const search: SearchFn =
    provider === "bgg"
      ? (q) => searchBoardGames(q, apiToken, bggMeta, sort)
      : (q) => searchBoardGamesLudopedia(q, apiToken, ludopediaMeta, sort);

  const byId = new Map<string, { row: SearchResult; rank: number }>();
  const tried = new Set<string>();
  let queryIndex = 0;

  const runQuery = async (q: string): Promise<BoardGameRecommendationsOutcome | null> => {
    const key = normalizeQueryKey(q);
    if (!key || tried.has(key)) return null;
    tried.add(key);
    if (byId.size >= maxResults) return null;

    const batch = await search(q);
    if (!batch) return null;
    if ("requiresApiKey" in batch && batch.results.length === 0) {
      return {
        results: [],
        requiresApiKey: batch.requiresApiKey as "bgg" | "ludopedia",
        link: batch.link,
        tutorial: batch.tutorial,
      };
    }
    const rankBase = queryIndex * 1000;
    let i = 0;
    for (const row of batch.results) {
      if (exclude.has(row.id) || byId.has(row.id)) {
        i += 1;
        continue;
      }
      byId.set(row.id, { row, rank: rankBase + i });
      i += 1;
      if (byId.size >= maxResults) break;
    }
    queryIndex += 1;
    return null;
  };

  for (const q of affinityQueries) {
    const early = await runQuery(q);
    if (early) return early;
    if (byId.size >= maxResults) break;
  }

  if (byId.size === 0) {
    for (const q of FALLBACK_QUERIES) {
      const early = await runQuery(q);
      if (early) return early;
      if (byId.size >= maxResults) break;
    }
  }

  const results = [...byId.values()]
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.row)
    .slice(0, maxResults);

  return {
    results,
    personalization: hadPositiveAffinity && affinityQueries.length > 0 ? "from_logs" : "popular",
  };
}
