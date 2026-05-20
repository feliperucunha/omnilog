import {
  decodeHtmlEntities,
  type SearchResult,
  type ItemDetail,
  SEARCH_RESULTS_PAGE_SIZE,
} from "@geeklogs/shared";
import { sortSearchResults } from "../lib/sortSearchResults.js";
import { InvalidApiKeyError } from "../lib/InvalidApiKeyError.js";

const BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w200";
const WATCH_PROVIDER_REGION = (process.env.TMDB_WATCH_REGION ?? "US").toUpperCase();

type WatchProviderRegion = {
  flatrate?: Array<{ provider_name?: string }>;
  free?: Array<{ provider_name?: string }>;
  ads?: Array<{ provider_name?: string }>;
};

export function streamingNamesFromWatchProviders(data: {
  results?: Record<string, WatchProviderRegion>;
}): string[] | null {
  const results = data.results;
  if (!results || typeof results !== "object") return null;
  const region =
    results[WATCH_PROVIDER_REGION] ??
    results.US ??
    Object.values(results).find(
      (r) => (r.flatrate?.length ?? 0) > 0 || (r.free?.length ?? 0) > 0
    );
  if (!region) return null;
  const names: string[] = [];
  for (const bucket of [region.flatrate, region.free, region.ads] as const) {
    for (const p of bucket ?? []) {
      const n = p.provider_name?.trim();
      if (n) names.push(decodeHtmlEntities(n));
    }
  }
  const unique = [...new Set(names)];
  return unique.length ? unique.slice(0, 10) : null;
}

function getKey(apiKey?: string | null): string | null {
  return apiKey ?? process.env.TMDB_API_KEY ?? null;
}

export async function getMovieById(id: string, apiKey?: string | null): Promise<ItemDetail | null> {
  const key = getKey(apiKey);
  if (!key) return null;
  const [res, providersRes] = await Promise.all([
    fetch(`${BASE}/movie/${id}?api_key=${key}`),
    fetch(`${BASE}/movie/${id}/watch/providers?api_key=${key}`),
  ]);
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("tmdb");
  if (!res.ok) return null;
  let networks: string[] | null = null;
  if (providersRes.ok) {
    const providerData = (await providersRes.json()) as { results?: Record<string, WatchProviderRegion> };
    networks = streamingNamesFromWatchProviders(providerData);
  }
  const data = (await res.json()) as {
    id?: number;
    title?: string;
    release_date?: string;
    poster_path?: string;
    runtime?: number;
    overview?: string;
    tagline?: string;
    vote_average?: number;
    status?: string;
    genres?: Array<{ name?: string }>;
    production_countries?: Array<{ name?: string }>;
    spoken_languages?: Array<{ name?: string; english_name?: string }>;
  };
  const runtimeMinutes = data.runtime && data.runtime > 0 ? data.runtime : null;
  const genres = data.genres
    ?.map((g) => g.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const productionCountries = data.production_countries
    ?.map((c) => c.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const spokenLanguages = data.spoken_languages
    ?.map((l) => l.english_name ?? l.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const overview = data.overview?.trim();
  const taglineRaw = data.tagline?.trim();
  return {
    id: String(data.id ?? id),
    title: decodeHtmlEntities(data.title ?? "Unknown"),
    image: data.poster_path ? `${IMAGE_BASE}${data.poster_path}` : null,
    year: data.release_date?.slice(0, 4) ?? null,
    subtitle: null,
    runtimeMinutes,
    description: overview ? decodeHtmlEntities(overview) : null,
    tagline: taglineRaw ? decodeHtmlEntities(taglineRaw) : null,
    score: typeof data.vote_average === "number" && data.vote_average > 0 ? data.vote_average : null,
    genres: genres?.length ? genres : null,
    releaseDate: data.release_date?.trim() ? decodeHtmlEntities(data.release_date.trim()) : null,
    status: data.status?.trim() ? decodeHtmlEntities(data.status.trim()) : null,
    productionCountries: productionCountries?.length ? productionCountries : null,
    spokenLanguages: spokenLanguages?.length ? spokenLanguages : null,
    networks: networks?.length ? networks : null,
  };
}

export async function getTvById(id: string, apiKey?: string | null): Promise<ItemDetail | null> {
  const key = getKey(apiKey);
  if (!key) return null;
  const res = await fetch(`${BASE}/tv/${id}?api_key=${key}`);
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("tmdb");
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id?: number;
    name?: string;
    first_air_date?: string;
    poster_path?: string;
    number_of_episodes?: number;
    number_of_seasons?: number;
    episode_run_time?: number[];
    overview?: string;
    tagline?: string;
    vote_average?: number;
    status?: string;
    genres?: Array<{ name?: string }>;
    networks?: Array<{ name?: string }>;
  };
  const epCount = data.number_of_episodes ?? 0;
  const runTimes = data.episode_run_time?.filter((t) => t != null && t > 0) ?? [];
  const avgMin = runTimes.length > 0 ? runTimes.reduce((a, b) => a + b, 0) / runTimes.length : 45;
  const runtimeMinutes = epCount > 0 ? Math.round(epCount * avgMin) : null;
  const genres = data.genres
    ?.map((g) => g.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const networks = data.networks
    ?.map((n) => n.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const overviewTv = data.overview?.trim();
  const taglineTv = data.tagline?.trim();
  return {
    id: String(data.id ?? id),
    title: decodeHtmlEntities(data.name ?? "Unknown"),
    image: data.poster_path ? `${IMAGE_BASE}${data.poster_path}` : null,
    year: data.first_air_date?.slice(0, 4) ?? null,
    subtitle: null,
    runtimeMinutes,
    description: overviewTv ? decodeHtmlEntities(overviewTv) : null,
    tagline: taglineTv ? decodeHtmlEntities(taglineTv) : null,
    score: typeof data.vote_average === "number" && data.vote_average > 0 ? data.vote_average : null,
    genres: genres?.length ? genres : null,
    episodesCount: epCount > 0 ? epCount : null,
    seasonsCount: (data.number_of_seasons ?? 0) > 0 ? data.number_of_seasons! : null,
    releaseDate: data.first_air_date?.trim() ? decodeHtmlEntities(data.first_air_date.trim()) : null,
    status: data.status?.trim() ? decodeHtmlEntities(data.status.trim()) : null,
    networks: networks?.length ? networks : null,
  };
}

/** Get episode numbers for a TV season (for progress dropdowns). */
export async function getTvSeasonEpisodeNumbers(
  seriesId: string,
  seasonNumber: number,
  apiKey?: string | null
): Promise<number[]> {
  const key = getKey(apiKey);
  if (!key) return [];
  const res = await fetch(
    `${BASE}/tv/${seriesId}/season/${seasonNumber}?api_key=${key}`
  );
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("tmdb");
  if (!res.ok) return [];
  const data = (await res.json()) as {
    episodes?: Array<{ episode_number?: number }>;
  };
  const episodes = data.episodes ?? [];
  const numbers = episodes
    .map((ep) => ep.episode_number)
    .filter((n): n is number => typeof n === "number" && n >= 0);
  return numbers.length > 0 ? numbers.sort((a, b) => a - b) : [];
}

export type SearchMoviesResult =
  | { results: SearchResult[] }
  | { results: []; requiresApiKey: "tmdb"; link: string; tutorial: string };

type TmdbMovieSearchRow = {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string;
};

type TmdbTvSearchRow = {
  id: number;
  name?: string;
  first_air_date?: string;
  poster_path?: string;
};

/** TMDB returns at most 20 hits per page; merge pages 1–2 for up to `SEARCH_RESULTS_PAGE_SIZE` unique ids. */
async function fetchMergedTmdbSearchRows<T extends { id: number }>(
  key: string,
  q: string,
  endpoint: "movie" | "tv"
): Promise<T[]> {
  const qEnc = encodeURIComponent(q);
  const res1 = await fetch(`${BASE}/search/${endpoint}?api_key=${key}&query=${qEnc}&page=1`);
  if (res1.status === 401 || res1.status === 403) throw new InvalidApiKeyError("tmdb");
  if (!res1.ok) return [];
  const data1 = (await res1.json()) as { results?: T[] };
  const page1 = data1.results ?? [];

  const res2 = await fetch(`${BASE}/search/${endpoint}?api_key=${key}&query=${qEnc}&page=2`);
  let page2: T[] = [];
  if (res2.ok) {
    const data2 = (await res2.json()) as { results?: T[] };
    page2 = data2.results ?? [];
  }

  const seen = new Set<number>();
  const merged: T[] = [];
  for (const item of [...page1, ...page2]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
    if (merged.length >= SEARCH_RESULTS_PAGE_SIZE) break;
  }
  return merged;
}

export async function searchMovies(
  q: string,
  apiKey?: string | null,
  meta?: { link: string; tutorial: string },
  sort?: string
): Promise<SearchMoviesResult> {
  const key = getKey(apiKey);
  if (!key) {
    return meta
      ? { results: [], requiresApiKey: "tmdb", link: meta.link, tutorial: meta.tutorial }
      : { results: [] };
  }
  const rows = await fetchMergedTmdbSearchRows<TmdbMovieSearchRow>(key, q, "movie");
  let results = rows.map((item) => ({
    id: String(item.id),
    title: decodeHtmlEntities(item.title ?? "Unknown"),
    image: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : null,
    year: item.release_date?.slice(0, 4) ?? null,
    subtitle: null,
  }));
  const sorted = sortSearchResults(results, sort) as typeof results;
  return { results: sorted };
}

export type SearchTvResult =
  | { results: SearchResult[] }
  | { results: []; requiresApiKey: "tmdb"; link: string; tutorial: string };

export async function searchTv(
  q: string,
  apiKey?: string | null,
  meta?: { link: string; tutorial: string },
  sort?: string
): Promise<SearchTvResult> {
  const key = getKey(apiKey);
  if (!key) {
    return meta
      ? { results: [], requiresApiKey: "tmdb", link: meta.link, tutorial: meta.tutorial }
      : { results: [] };
  }
  const rows = await fetchMergedTmdbSearchRows<TmdbTvSearchRow>(key, q, "tv");
  let results = rows.map((item) => ({
    id: String(item.id),
    title: decodeHtmlEntities(item.name ?? "Unknown"),
    image: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : null,
    year: item.first_air_date?.slice(0, 4) ?? null,
    subtitle: null,
  }));
  const sorted = sortSearchResults(results, sort) as typeof results;
  return { results: sorted };
}

function mapMovieListItem(item: {
  id: number;
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  vote_average?: number;
}): SearchResult {
  return {
    id: String(item.id),
    title: decodeHtmlEntities(item.title ?? "Unknown"),
    image: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : null,
    year: item.release_date?.slice(0, 4) ?? null,
    subtitle: null,
    score: typeof item.vote_average === "number" && item.vote_average > 0 ? item.vote_average : null,
  };
}

function mapTvListItem(item: {
  id: number;
  name?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
}): SearchResult {
  return {
    id: String(item.id),
    title: decodeHtmlEntities(item.name ?? "Unknown"),
    image: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : null,
    year: item.first_air_date?.slice(0, 4) ?? null,
    subtitle: null,
    score: typeof item.vote_average === "number" && item.vote_average > 0 ? item.vote_average : null,
  };
}

/** Merge TMDB recommendations + similar; dedupe by id. */
export async function getMovieRecommendationsMerged(
  movieId: string,
  apiKey?: string | null,
  maxTotal = 16
): Promise<SearchResult[]> {
  const key = getKey(apiKey);
  if (!key) return [];
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  const paths = [`movie/${movieId}/recommendations`, `movie/${movieId}/similar`] as const;
  for (const path of paths) {
    const res = await fetch(`${BASE}/${path}?api_key=${key}&language=en-US`);
    if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("tmdb");
    if (!res.ok) continue;
    const data = (await res.json()) as {
      results?: Array<{
        id: number;
        title?: string;
        release_date?: string;
        poster_path?: string | null;
        vote_average?: number;
      }>;
    };
    for (const item of data.results ?? []) {
      const row = mapMovieListItem(item);
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
      if (out.length >= maxTotal) return out;
    }
  }
  return out;
}

export async function getTvRecommendationsMerged(
  tvId: string,
  apiKey?: string | null,
  maxTotal = 16
): Promise<SearchResult[]> {
  const key = getKey(apiKey);
  if (!key) return [];
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  const paths = [`tv/${tvId}/recommendations`, `tv/${tvId}/similar`] as const;
  for (const path of paths) {
    const res = await fetch(`${BASE}/${path}?api_key=${key}&language=en-US`);
    if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("tmdb");
    if (!res.ok) continue;
    const data = (await res.json()) as {
      results?: Array<{
        id: number;
        name?: string;
        first_air_date?: string;
        poster_path?: string | null;
        vote_average?: number;
      }>;
    };
    for (const item of data.results ?? []) {
      const row = mapTvListItem(item);
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
      if (out.length >= maxTotal) return out;
    }
  }
  return out;
}

/** Discover highly user-rated titles (min vote count avoids one-vote 10/10 noise). */
const TMDB_DISCOVER_MIN_VOTES_MOVIE = 200;
const TMDB_DISCOVER_MIN_VOTES_TV = 80;

export async function getPopularMovies(apiKey?: string | null, max = 12): Promise<SearchResult[]> {
  const key = getKey(apiKey);
  if (!key) return [];
  const res = await fetch(
    `${BASE}/discover/movie?api_key=${key}&sort_by=vote_average.desc&vote_count.gte=${TMDB_DISCOVER_MIN_VOTES_MOVIE}&language=en-US&page=1`
  );
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("tmdb");
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{
      id: number;
      title?: string;
      release_date?: string;
      poster_path?: string | null;
      vote_average?: number;
    }>;
  };
  return (data.results ?? []).slice(0, max).map(mapMovieListItem);
}

export async function getPopularTv(apiKey?: string | null, max = 12): Promise<SearchResult[]> {
  const key = getKey(apiKey);
  if (!key) return [];
  const res = await fetch(
    `${BASE}/discover/tv?api_key=${key}&sort_by=vote_average.desc&vote_count.gte=${TMDB_DISCOVER_MIN_VOTES_TV}&language=en-US&page=1`
  );
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("tmdb");
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{
      id: number;
      name?: string;
      first_air_date?: string;
      poster_path?: string | null;
      vote_average?: number;
    }>;
  };
  return (data.results ?? []).slice(0, max).map(mapTvListItem);
}
