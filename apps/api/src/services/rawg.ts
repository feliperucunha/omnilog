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
