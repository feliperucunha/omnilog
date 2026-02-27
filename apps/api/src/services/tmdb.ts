import type { SearchResult, ItemDetail } from "@logeverything/shared";
import { sortSearchResults } from "../lib/sortSearchResults.js";

const BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w200";

function getKey(apiKey?: string | null): string | null {
  return apiKey ?? process.env.TMDB_API_KEY ?? null;
}

export async function getMovieById(id: string, apiKey?: string | null): Promise<ItemDetail | null> {
  const key = getKey(apiKey);
  if (!key) return null;
  const res = await fetch(`${BASE}/movie/${id}?api_key=${key}`);
  if (!res.ok) return null;
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
  const genres = data.genres?.map((g) => g.name).filter(Boolean) as string[] | undefined;
  const productionCountries = data.production_countries?.map((c) => c.name).filter(Boolean) as string[] | undefined;
  const spokenLanguages = data.spoken_languages?.map((l) => l.english_name ?? l.name).filter(Boolean) as string[] | undefined;
  return {
    id: String(data.id ?? id),
    title: data.title ?? "Unknown",
    image: data.poster_path ? `${IMAGE_BASE}${data.poster_path}` : null,
    year: data.release_date?.slice(0, 4) ?? null,
    subtitle: null,
    runtimeMinutes,
    description: data.overview?.trim() || null,
    tagline: data.tagline?.trim() || null,
    score: typeof data.vote_average === "number" && data.vote_average > 0 ? data.vote_average : null,
    genres: genres?.length ? genres : null,
    releaseDate: data.release_date?.trim() || null,
    status: data.status?.trim() || null,
    productionCountries: productionCountries?.length ? productionCountries : null,
    spokenLanguages: spokenLanguages?.length ? spokenLanguages : null,
  };
}

export async function getTvById(id: string, apiKey?: string | null): Promise<ItemDetail | null> {
  const key = getKey(apiKey);
  if (!key) return null;
  const res = await fetch(`${BASE}/tv/${id}?api_key=${key}`);
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
  const genres = data.genres?.map((g) => g.name).filter(Boolean) as string[] | undefined;
  const networks = data.networks?.map((n) => n.name).filter(Boolean) as string[] | undefined;
  return {
    id: String(data.id ?? id),
    title: data.name ?? "Unknown",
    image: data.poster_path ? `${IMAGE_BASE}${data.poster_path}` : null,
    year: data.first_air_date?.slice(0, 4) ?? null,
    subtitle: null,
    runtimeMinutes,
    description: data.overview?.trim() || null,
    tagline: data.tagline?.trim() || null,
    score: typeof data.vote_average === "number" && data.vote_average > 0 ? data.vote_average : null,
    genres: genres?.length ? genres : null,
    episodesCount: epCount > 0 ? epCount : null,
    seasonsCount: (data.number_of_seasons ?? 0) > 0 ? data.number_of_seasons! : null,
    releaseDate: data.first_air_date?.trim() || null,
    status: data.status?.trim() || null,
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
  const res = await fetch(
    `${BASE}/search/movie?api_key=${key}&query=${encodeURIComponent(q)}`
  );
  if (!res.ok) return { results: [] };
  const data = (await res.json()) as { results?: Array<{ id: number; title?: string; release_date?: string; poster_path?: string }> };
  let results = (data.results ?? []).slice(0, 20).map((item) => ({
    id: String(item.id),
    title: item.title ?? "Unknown",
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
  const res = await fetch(
    `${BASE}/search/tv?api_key=${key}&query=${encodeURIComponent(q)}`
  );
  if (!res.ok) return { results: [] };
  const data = (await res.json()) as { results?: Array<{ id: number; name?: string; first_air_date?: string; poster_path?: string }> };
  let results = (data.results ?? []).slice(0, 20).map((item) => ({
    id: String(item.id),
    title: item.name ?? "Unknown",
    image: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : null,
    year: item.first_air_date?.slice(0, 4) ?? null,
    subtitle: null,
  }));
  const sorted = sortSearchResults(results, sort) as typeof results;
  return { results: sorted };
}
