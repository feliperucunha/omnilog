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
  const data = (await res.json()) as { id?: number; title?: string; release_date?: string; poster_path?: string; runtime?: number };
  const runtimeMinutes = data.runtime && data.runtime > 0 ? data.runtime : null;
  return {
    id: String(data.id ?? id),
    title: data.title ?? "Unknown",
    image: data.poster_path ? `${IMAGE_BASE}${data.poster_path}` : null,
    year: data.release_date?.slice(0, 4) ?? null,
    subtitle: null,
    runtimeMinutes,
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
    episode_run_time?: number[];
  };
  const epCount = data.number_of_episodes ?? 0;
  const runTimes = data.episode_run_time?.filter((t) => t != null && t > 0) ?? [];
  const avgMin = runTimes.length > 0 ? runTimes.reduce((a, b) => a + b, 0) / runTimes.length : 45;
  const runtimeMinutes = epCount > 0 ? Math.round(epCount * avgMin) : null;
  return {
    id: String(data.id ?? id),
    title: data.name ?? "Unknown",
    image: data.poster_path ? `${IMAGE_BASE}${data.poster_path}` : null,
    year: data.first_air_date?.slice(0, 4) ?? null,
    subtitle: null,
    runtimeMinutes,
  };
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
