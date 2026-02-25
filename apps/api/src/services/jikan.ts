import type { SearchResult, ItemDetail } from "@logeverything/shared";

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

function toItemDetail(
  d: { mal_id?: number; title?: string; published?: { from?: string }; images?: { jpg?: { image_url?: string } } },
  id: string
): ItemDetail {
  const year = d.published?.from ? d.published.from.slice(0, 4) : null;
  return {
    id: String(d.mal_id ?? id),
    title: d.title ?? "Unknown",
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
  const description = d.synopsis?.trim().slice(0, 2000) || null;
  const genres = d.genres?.map((g) => g.name).filter(Boolean) as string[] | undefined;
  const studios = d.studios?.map((s) => s.name).filter(Boolean) as string[] | undefined;
  const themes = d.themes?.map((t) => t.name).filter(Boolean) as string[] | undefined;
  const duration = (typeof d.duration === "string" && d.duration.trim()) ? d.duration.trim() : null;
  return {
    id: String(d.mal_id ?? id),
    title: d.title ?? "Unknown",
    image: d.images?.jpg?.image_url ?? null,
    year: d.year != null ? String(d.year) : null,
    subtitle: null,
    description: description ?? null,
    score: typeof d.score === "number" && d.score > 0 ? d.score : null,
    contentRating: d.rating?.trim() || null,
    episodesCount: (d.episodes ?? 0) > 0 ? d.episodes! : null,
    genres: genres?.length ? genres : null,
    studios: studios?.length ? studios : null,
    themes: themes?.length ? themes : null,
    duration: duration ?? null,
  };
}

export async function searchAnime(q: string, sort?: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q, limit: "20" });
  const order = jikanOrderParams(sort);
  if (order.order_by) params.set("order_by", order.order_by);
  if (order.sort) params.set("sort", order.sort);
  const res = await fetch(
    `${BASE}/anime?${params.toString()}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      mal_id: number;
      title?: string;
      year?: number;
      images?: { jpg?: { image_url?: string } };
    }>;
  };
  const list = data.data ?? [];
  return list.map((item) => ({
    id: String(item.mal_id),
    title: item.title ?? "Unknown",
    image: item.images?.jpg?.image_url ?? null,
    year: item.year != null ? String(item.year) : null,
    subtitle: null,
  }));
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
      serialization?: { name?: string };
    };
  };
  const d = data.data;
  if (!d) return null;
  const year = d.published?.from ? d.published.from.slice(0, 4) : null;
  const description = d.synopsis?.trim().slice(0, 2000) || null;
  const genres = d.genres?.map((g) => g.name).filter(Boolean) as string[] | undefined;
  const serialization = (d.serialization?.name?.trim()) || null;
  return {
    id: String(d.mal_id ?? id),
    title: d.title ?? "Unknown",
    image: d.images?.jpg?.image_url ?? null,
    year: year ?? null,
    subtitle: null,
    description: description ?? null,
    score: typeof d.score === "number" && d.score > 0 ? d.score : null,
    chaptersCount: (d.chapters ?? 0) > 0 ? d.chapters! : null,
    volumesCount: (d.volumes ?? 0) > 0 ? d.volumes! : null,
    genres: genres?.length ? genres : null,
    serialization: serialization ?? null,
  };
}

export async function searchManga(q: string, sort?: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q, limit: "20" });
  const order = jikanOrderParams(sort);
  if (order.order_by) params.set("order_by", order.order_by);
  if (order.sort) params.set("sort", order.sort);
  const res = await fetch(
    `${BASE}/manga?${params.toString()}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      mal_id: number;
      title?: string;
      published?: { from?: string };
      images?: { jpg?: { image_url?: string } };
    }>;
  };
  const list = data.data ?? [];
  return list.map((item) => {
    const year = item.published?.from ? item.published.from.slice(0, 4) : null;
    return {
      id: String(item.mal_id),
      title: item.title ?? "Unknown",
      image: item.images?.jpg?.image_url ?? null,
      year: year ?? null,
      subtitle: null,
    };
  });
}
