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
    data?: { mal_id?: number; title?: string; year?: number; images?: { jpg?: { image_url?: string } } };
  };
  const d = data.data;
  if (!d) return null;
  return {
    id: String(d.mal_id ?? id),
    title: d.title ?? "Unknown",
    image: d.images?.jpg?.image_url ?? null,
    year: d.year != null ? String(d.year) : null,
    subtitle: null,
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
    data?: { mal_id?: number; title?: string; published?: { from?: string }; images?: { jpg?: { image_url?: string } } };
  };
  const d = data.data;
  if (!d) return null;
  return toItemDetail(d, id);
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
