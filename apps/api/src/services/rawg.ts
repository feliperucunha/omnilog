import type { SearchResult, ItemDetail } from "@dogument/shared";
import { InvalidApiKeyError } from "../lib/InvalidApiKeyError.js";

const BASE = "https://api.rawg.io/api";

function getKey(apiKey?: string | null): string | null {
  return apiKey ?? process.env.RAWG_API_KEY ?? null;
}

type RawgGameListRow = {
  id: number;
  name?: string;
  released?: string;
  background_image?: string;
  playtime?: number;
  genres?: Array<{ name?: string }>;
};

function mapRawgGameToSearchResult(item: RawgGameListRow): SearchResult {
  const timeToBeatHours =
    typeof item.playtime === "number" && item.playtime > 0 ? item.playtime : null;
  const genres = item.genres?.map((g) => g.name).filter(Boolean) as string[] | undefined;
  return {
    id: String(item.id),
    title: item.name ?? "Unknown",
    image: item.background_image ?? null,
    year: item.released?.slice(0, 4) ?? null,
    subtitle: null,
    timeToBeatHours,
    genres: genres?.length ? genres : undefined,
  };
}

/** Genre IDs for a game (used for recommendations; consumer API keys cannot use /games/{id}/suggested). */
async function fetchRawgGameGenreIds(gameId: string, apiKey?: string | null): Promise<number[]> {
  const key = getKey(apiKey);
  if (!key) return [];
  const res = await fetch(`${BASE}/games/${encodeURIComponent(gameId)}?key=${key}`);
  if (res.status === 401) throw new InvalidApiKeyError("rawg");
  if (!res.ok) return [];
  const data = (await res.json()) as { genres?: Array<{ id?: number }> };
  return (data.genres ?? [])
    .map((g) => g.id)
    .filter((id): id is number => typeof id === "number" && id > 0);
}

/**
 * Recommend games sharing genres with the user's recent logs (works with standard RAWG API keys).
 * RAWG "suggested" is business/enterprise-only; this uses GET /games?genres=… instead.
 */
export async function getGamesRecommendationsFromSeedsViaGenres(
  seedGameIds: string[],
  exclude: Set<string>,
  maxResults: number,
  apiKey?: string | null,
  maxSeeds = 4
): Promise<SearchResult[]> {
  const key = getKey(apiKey);
  if (!key || seedGameIds.length === 0) return [];
  const seeds = seedGameIds.slice(0, maxSeeds);
  const genreBatches = await Promise.all(seeds.map((id) => fetchRawgGameGenreIds(id, apiKey)));
  const genreIds = new Set<number>();
  for (const ids of genreBatches) {
    for (const gid of ids.slice(0, 4)) genreIds.add(gid);
  }
  const gidList = [...genreIds].slice(0, 6);
  if (gidList.length === 0) return [];

  const params = new URLSearchParams({
    key,
    page_size: String(Math.min(40, Math.max(maxResults * 3, 20))),
    ordering: "-rating",
    genres: gidList.join(","),
  });
  const res = await fetch(`${BASE}/games?${params.toString()}`);
  if (res.status === 401) throw new InvalidApiKeyError("rawg");
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: RawgGameListRow[] };
  const seedSet = new Set(seeds);
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const item of data.results ?? []) {
    const row = mapRawgGameToSearchResult(item);
    if (exclude.has(row.id) || seedSet.has(row.id) || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= maxResults) break;
  }
  return out;
}

export async function getGameById(id: string, apiKey?: string | null): Promise<ItemDetail | null> {
  const key = getKey(apiKey);
  if (!key) return null;
  const res = await fetch(`${BASE}/games/${id}?key=${key}`);
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("rawg");
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id?: number;
    name?: string;
    released?: string;
    background_image?: string;
    playtime?: number;
    description_raw?: string;
    description?: string;
    metacritic?: number;
    genres?: Array<{ name?: string }>;
    platforms?: Array<{ platform?: { name?: string } }>;
    developers?: Array<{ name?: string }>;
    publishers?: Array<{ name?: string }>;
    esrb_rating?: { name?: string };
    tags?: Array<{ name?: string }>;
  };
  const timeToBeatHours =
    typeof data.playtime === "number" && data.playtime > 0 ? data.playtime : null;
  const description = (data.description_raw ?? data.description)?.trim();
  const genres = data.genres?.map((g) => g.name).filter(Boolean) as string[] | undefined;
  const platforms = data.platforms?.map((p) => p.platform?.name).filter(Boolean) as string[] | undefined;
  const developers = data.developers?.map((d) => d.name).filter(Boolean) as string[] | undefined;
  const publishers = data.publishers?.map((p) => p.name).filter(Boolean) as string[] | undefined;
  const tags = data.tags?.map((t) => t.name).filter(Boolean) as string[] | undefined;
  const score = typeof data.metacritic === "number" && data.metacritic > 0 ? data.metacritic / 10 : null;
  const esrbRating = data.esrb_rating?.name?.trim() || null;
  return {
    id: String(data.id ?? id),
    title: data.name ?? "Unknown",
    image: data.background_image ?? null,
    year: data.released?.slice(0, 4) ?? null,
    subtitle: null,
    timeToBeatHours,
    description: description || null,
    genres: genres?.length ? genres : null,
    score: score ?? null,
    platforms: platforms?.length ? platforms : null,
    releaseDate: data.released?.trim() || null,
    developers: developers?.length ? developers : null,
    publishers: publishers?.length ? publishers : null,
    esrbRating: esrbRating ?? null,
    tags: tags?.length ? tags : null,
  };
}

export type SearchGamesResult =
  | { results: SearchResult[] }
  | { results: []; requiresApiKey: "rawg"; link: string; tutorial: string };

/** Map our sort value to RAWG ordering param (https://api.rawg.io/docs). */
function rawgOrdering(sort: string | undefined): string | undefined {
  if (!sort || sort === "relevance") return undefined;
  switch (sort) {
    case "released_desc": return "-released";
    case "released_asc": return "released";
    case "rating_desc": return "-rating";
    case "name_asc": return "name";
    case "name_desc": return "-name";
    default: return undefined;
  }
}

export async function searchGames(
  q: string,
  apiKey?: string | null,
  meta?: { link: string; tutorial: string },
  sort?: string
): Promise<SearchGamesResult> {
  const key = getKey(apiKey);
  if (!key) {
    return meta
      ? { results: [], requiresApiKey: "rawg", link: meta.link, tutorial: meta.tutorial }
      : { results: [] };
  }
  const ordering = rawgOrdering(sort);
  const params = new URLSearchParams({ key, search: q, page_size: "20" });
  if (ordering) params.set("ordering", ordering);
  const res = await fetch(
    `${BASE}/games?${params.toString()}`
  );
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("rawg");
  if (!res.ok) return { results: [] };
  const data = (await res.json()) as { results?: RawgGameListRow[] };
  const results = (data.results ?? []).map((item) => mapRawgGameToSearchResult(item));
  return { results };
}

/** Enterprise-only on RAWG; consumer keys should use getGamesRecommendationsFromSeedsViaGenres. */
export async function getGameSuggestionsFromRawg(
  gameId: string,
  apiKey?: string | null,
  max = 12
): Promise<SearchResult[]> {
  const key = getKey(apiKey);
  if (!key) return [];
  const res = await fetch(`${BASE}/games/${encodeURIComponent(gameId)}/suggested?key=${key}&page_size=${max}`);
  if (res.status === 401) throw new InvalidApiKeyError("rawg");
  // 403/404: not available on consumer API tier or unknown game
  if (res.status === 403 || res.status === 404 || !res.ok) return [];
  const data = (await res.json()) as { results?: RawgGameListRow[] };
  return (data.results ?? []).slice(0, max).map((item) => mapRawgGameToSearchResult(item));
}

/** Discover popular / highly rated games (same shape as search results). */
export async function getPopularGames(apiKey?: string | null, max = 12): Promise<SearchResult[]> {
  const key = getKey(apiKey);
  if (!key) return [];
  const params = new URLSearchParams({ key, page_size: String(max), ordering: "-rating" });
  const res = await fetch(`${BASE}/games?${params.toString()}`);
  if (res.status === 401) throw new InvalidApiKeyError("rawg");
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: RawgGameListRow[] };
  return (data.results ?? []).slice(0, max).map((item) => mapRawgGameToSearchResult(item));
}
