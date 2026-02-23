import type { SearchResult, ItemDetail } from "@logeverything/shared";

const BASE = "https://api.rawg.io/api";

function getKey(apiKey?: string | null): string | null {
  return apiKey ?? process.env.RAWG_API_KEY ?? null;
}

export async function getGameById(id: string, apiKey?: string | null): Promise<ItemDetail | null> {
  const key = getKey(apiKey);
  if (!key) return null;
  const res = await fetch(`${BASE}/games/${id}?key=${key}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: number; name?: string; released?: string; background_image?: string };
  return {
    id: String(data.id ?? id),
    title: data.name ?? "Unknown",
    image: data.background_image ?? null,
    year: data.released?.slice(0, 4) ?? null,
    subtitle: null,
  };
}

export type SearchGamesResult =
  | { results: SearchResult[] }
  | { results: []; requiresApiKey: "rawg"; link: string; tutorial: string };

export async function searchGames(
  q: string,
  apiKey?: string | null,
  meta?: { link: string; tutorial: string }
): Promise<SearchGamesResult> {
  const key = getKey(apiKey);
  if (!key) {
    return meta
      ? { results: [], requiresApiKey: "rawg", link: meta.link, tutorial: meta.tutorial }
      : { results: [] };
  }
  const res = await fetch(
    `${BASE}/games?key=${key}&search=${encodeURIComponent(q)}&page_size=20`
  );
  if (!res.ok) return { results: [] };
  const data = (await res.json()) as {
    results?: Array<{
      id: number;
      name?: string;
      released?: string;
      background_image?: string;
    }>;
  };
  const results = (data.results ?? []).map((item) => ({
    id: String(item.id),
    title: item.name ?? "Unknown",
    image: item.background_image ?? null,
    year: item.released?.slice(0, 4) ?? null,
    subtitle: null,
  }));
  return { results };
}
