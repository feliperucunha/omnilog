import {
  decodeHtmlEntities,
  type SearchResult,
  type ItemDetail,
  SEARCH_RESULTS_PAGE_SIZE,
} from "@geeklogs/shared";
import { sortSearchResults } from "../lib/sortSearchResults.js";

/** Map our sort value to Jikan order_by and sort (asc/desc). */
function jikanOrderParams(sort: string | undefined): { order_by?: string; sort?: string } {
  if (!sort || sort === "relevance") return {};
  switch (sort) {
    case "title_asc": return { order_by: "title", sort: "asc" };
    case "title_desc": return { order_by: "title", sort: "desc" };
    case "score_desc": return { order_by: "score", sort: "desc" };
    case "start_date_desc": return { order_by: "start_date", sort: "desc" };
    case "start_date_asc": return { order_by: "start_date", sort: "asc" };
    default: return {};
  }
}

const BASE = "https://api.jikan.moe/v4";

/** Jikan caps `limit` at 25 per page; merge two pages for up to `SEARCH_RESULTS_PAGE_SIZE` unique MAL ids. */
const JIKAN_SEARCH_PAGE_LIMIT = 25;

function mergeJikanRowsByMalId<T extends { mal_id: number }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.mal_id)) continue;
    seen.add(row.mal_id);
    out.push(row);
    if (out.length >= SEARCH_RESULTS_PAGE_SIZE) break;
  }
  return out;
}

async function fetchJikanSearchPages<T extends { mal_id: number }>(
  path: "anime" | "manga",
  q: string,
  sort: string | undefined
): Promise<T[]> {
  const buildParams = (page: string) => {
    const params = new URLSearchParams({
      q,
      limit: String(JIKAN_SEARCH_PAGE_LIMIT),
      page,
    });
    const order = jikanOrderParams(sort);
    if (order.order_by) params.set("order_by", order.order_by);
    if (order.sort) params.set("sort", order.sort);
    return params;
  };
  const [res1, res2] = await Promise.all([
    fetch(`${BASE}/${path}?${buildParams("1").toString()}`),
    fetch(`${BASE}/${path}?${buildParams("2").toString()}`),
  ]);
  if (!res1.ok) return [];
  const data1 = (await res1.json()) as { data?: T[] };
  const page1 = data1.data ?? [];
  let page2: T[] = [];
  if (res2.ok) {
    const data2 = (await res2.json()) as { data?: T[] };
    page2 = data2.data ?? [];
  }
  return mergeJikanRowsByMalId([...page1, ...page2]);
}

function toItemDetail(
  d: { mal_id?: number; title?: string; published?: { from?: string }; images?: { jpg?: { image_url?: string } } },
  id: string
): ItemDetail {
  const year = d.published?.from ? d.published.from.slice(0, 4) : null;
  return {
    id: String(d.mal_id ?? id),
    title: decodeHtmlEntities(d.title ?? "Unknown"),
    image: d.images?.jpg?.image_url ?? null,
    year: year ?? null,
    subtitle: null,
  };
}

export async function getAnimeById(id: string): Promise<ItemDetail | null> {
  const res = await fetch(`${BASE}/anime/${id}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    data?: {
      mal_id?: number;
      title?: string;
      year?: number;
      images?: { jpg?: { image_url?: string } };
      synopsis?: string;
      score?: number;
      rating?: string;
      episodes?: number | null;
      genres?: Array<{ name?: string }>;
      studios?: Array<{ name?: string }>;
      themes?: Array<{ name?: string }>;
      duration?: string | null;
    };
  };
  const d = data.data;
  if (!d) return null;
  const synopsisRaw = d.synopsis?.trim().slice(0, 2000) || null;
  const description = synopsisRaw ? decodeHtmlEntities(synopsisRaw) : null;
  const genres = d.genres
    ?.map((g) => g.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const studios = d.studios
    ?.map((s) => s.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const themes = d.themes
    ?.map((t) => t.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const duration = (typeof d.duration === "string" && d.duration.trim()) ? decodeHtmlEntities(d.duration.trim()) : null;
  return {
    id: String(d.mal_id ?? id),
    title: decodeHtmlEntities(d.title ?? "Unknown"),
    image: d.images?.jpg?.image_url ?? null,
    year: d.year != null ? String(d.year) : null,
    subtitle: null,
    description: description ?? null,
    score: typeof d.score === "number" && d.score > 0 ? d.score : null,
    contentRating: d.rating?.trim() ? decodeHtmlEntities(d.rating.trim()) : null,
    episodesCount: (d.episodes ?? 0) > 0 ? d.episodes! : null,
    genres: genres?.length ? genres : null,
    studios: studios?.length ? studios : null,
    themes: themes?.length ? themes : null,
    duration: duration ?? null,
  };
}

export async function searchAnime(q: string, sort?: string): Promise<SearchResult[]> {
  type Row = {
    mal_id: number;
    title?: string;
    year?: number;
    score?: number;
    images?: { jpg?: { image_url?: string } };
  };
  const list = await fetchJikanSearchPages<Row>("anime", q, sort);
  const results = list.map((item) => ({
    id: String(item.mal_id),
    title: decodeHtmlEntities(item.title ?? "Unknown"),
    image: item.images?.jpg?.image_url ?? null,
    year: item.year != null ? String(item.year) : null,
    subtitle: null,
    score: typeof item.score === "number" && item.score > 0 ? item.score : null,
  }));
  return sortSearchResults(results, sort);
}

export async function getMangaById(id: string): Promise<ItemDetail | null> {
  const res = await fetch(`${BASE}/manga/${id}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    data?: {
      mal_id?: number;
      title?: string;
      published?: { from?: string };
      images?: { jpg?: { image_url?: string } };
      synopsis?: string;
      score?: number;
      chapters?: number | null;
      volumes?: number | null;
      genres?: Array<{ name?: string }>;
      themes?: Array<{ name?: string }>;
      demographics?: Array<{ name?: string }>;
      serialization?: { name?: string };
      serializations?: Array<{ name?: string }>;
    };
  };
  const d = data.data;
  if (!d) return null;
  const year = d.published?.from ? d.published.from.slice(0, 4) : null;
  const synopsisManga = d.synopsis?.trim().slice(0, 2000) || null;
  const description = synopsisManga ? decodeHtmlEntities(synopsisManga) : null;
  const genres = d.genres
    ?.map((g) => g.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const themes = d.themes
    ?.map((t) => t.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const demographics = d.demographics
    ?.map((x) => x.name)
    .filter(Boolean)
    .map((n) => decodeHtmlEntities(n as string)) as string[] | undefined;
  const serializationRaw =
    (Array.isArray(d.serializations) && d.serializations.length > 0
      ? d.serializations[0]?.name?.trim()
      : d.serialization?.name?.trim()) || null;
  const serialization = serializationRaw ? decodeHtmlEntities(serializationRaw) : null;
  return {
    id: String(d.mal_id ?? id),
    title: decodeHtmlEntities(d.title ?? "Unknown"),
    image: d.images?.jpg?.image_url ?? null,
    year: year ?? null,
    subtitle: null,
    description: description ?? null,
    score: typeof d.score === "number" && d.score > 0 ? d.score : null,
    chaptersCount: (d.chapters ?? 0) > 0 ? d.chapters! : null,
    volumesCount: (d.volumes ?? 0) > 0 ? d.volumes! : null,
    genres: genres?.length ? genres : null,
    themes: themes?.length ? themes : null,
    demographics: demographics?.length ? demographics : null,
    serialization: serialization ?? null,
  };
}

export async function searchManga(q: string, sort?: string): Promise<SearchResult[]> {
  type Row = {
    mal_id: number;
    title?: string;
    published?: { from?: string };
    score?: number;
    images?: { jpg?: { image_url?: string } };
  };
  const list = await fetchJikanSearchPages<Row>("manga", q, sort);
  const results = list.map((item) => {
    const year = item.published?.from ? item.published.from.slice(0, 4) : null;
    return {
      id: String(item.mal_id),
      title: decodeHtmlEntities(item.title ?? "Unknown"),
      image: item.images?.jpg?.image_url ?? null,
      year: year ?? null,
      subtitle: null,
      score: typeof item.score === "number" && item.score > 0 ? item.score : null,
    };
  });
  return sortSearchResults(results, sort);
}

/** Jikan /anime/{id}/recommendations (rate-limit friendly: caller should not burst). */
export async function getAnimeRecommendationsForId(animeId: string, maxTotal = 16): Promise<SearchResult[]> {
  const res = await fetch(`${BASE}/anime/${animeId}/recommendations`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      entry?: {
        mal_id?: number;
        title?: string;
        year?: number;
        images?: { jpg?: { image_url?: string } };
      };
    }>;
  };
  const out: SearchResult[] = [];
  for (const row of data.data ?? []) {
    const e = row.entry;
    if (e?.mal_id == null) continue;
    out.push({
      id: String(e.mal_id),
      title: decodeHtmlEntities(e.title ?? "Unknown"),
      image: e.images?.jpg?.image_url ?? null,
      year: e.year != null ? String(e.year) : null,
      subtitle: null,
    });
    if (out.length >= maxTotal) break;
  }
  return out;
}

/** Highest MAL score first (better default than popularity when user has no logs). */
export async function getTopMangaByScore(max = 12): Promise<SearchResult[]> {
  const res = await fetch(`${BASE}/manga?order_by=score&sort=desc&limit=${max}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      mal_id: number;
      title?: string;
      published?: { from?: string };
      score?: number;
      images?: { jpg?: { image_url?: string } };
    }>;
  };
  return (data.data ?? []).map((item) => {
    const year = item.published?.from ? item.published.from.slice(0, 4) : null;
    return {
      id: String(item.mal_id),
      title: decodeHtmlEntities(item.title ?? "Unknown"),
      image: item.images?.jpg?.image_url ?? null,
      year: year ?? null,
      subtitle: null,
      score: typeof item.score === "number" && item.score > 0 ? item.score : null,
    };
  });
}

/** @deprecated Use getTopMangaByScore for rating-ordered lists. */
export const getTopMangaPopular = getTopMangaByScore;

/** Highest MAL score first (better default than popularity when user has no logs). */
export async function getTopAnimeByScore(max = 12): Promise<SearchResult[]> {
  const res = await fetch(`${BASE}/anime?order_by=score&sort=desc&limit=${max}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      mal_id: number;
      title?: string;
      year?: number;
      score?: number;
      images?: { jpg?: { image_url?: string } };
    }>;
  };
  return (data.data ?? []).map((item) => ({
    id: String(item.mal_id),
    title: decodeHtmlEntities(item.title ?? "Unknown"),
    image: item.images?.jpg?.image_url ?? null,
    year: item.year != null ? String(item.year) : null,
    subtitle: null,
    score: typeof item.score === "number" && item.score > 0 ? item.score : null,
  }));
}

/** @deprecated Use getTopAnimeByScore for rating-ordered lists. */
export const getTopAnimePopular = getTopAnimeByScore;
