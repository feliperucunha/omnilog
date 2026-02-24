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
  const data = (await res.json()) as {
    id?: number;
    name?: string;
    released?: string;
    background_image?: string;
    playtime?: number;
  };
  const timeToBeatHours =
    typeof data.playtime === "number" && data.playtime > 0 ? data.playtime : null;
  return {
    id: String(data.id ?? id),
    title: data.name ?? "Unknown",
    image: data.background_image ?? null,
    year: data.released?.slice(0, 4) ?? null,
    subtitle: null,
    timeToBeatHours,
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
  if (!res.ok) return { results: [] };
  const data = (await res.json()) as {
    results?: Array<{
      id: number;
      name?: string;
      released?: string;
      background_image?: string;
      playtime?: number;
    }>;
  };
  const results = (data.results ?? []).map((item) => {
    const timeToBeatHours =
      typeof item.playtime === "number" && item.playtime > 0 ? item.playtime : null;
    return {
      id: String(item.id),
      title: item.name ?? "Unknown",
      image: item.background_image ?? null,
      year: item.released?.slice(0, 4) ?? null,
      subtitle: null,
      timeToBeatHours,
    };
  });
  return { results };
}
