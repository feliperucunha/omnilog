import type { SearchResult, ItemDetail } from "@logeverything/shared";
import { sortSearchResults } from "../lib/sortSearchResults.js";

const BASE = "https://comicvine.gamespot.com/api";

function buildUrl(path: string, apiKey: string, params?: Record<string, string>): string {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return url.toString();
}

export async function getVolumeById(
  id: string,
  apiKey: string | null | undefined
): Promise<ItemDetail | null> {
  if (!apiKey?.trim()) return null;
  const res = await fetch(buildUrl(`/volume/4050-${id.replace(/^4050-/, "")}/`, apiKey));
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status_code?: number;
    results?: { id?: number; name?: string; image?: { medium_url?: string }; start_year?: string };
  };
  if (data.status_code !== 1 || !data.results) return null;
  const d = data.results;
  return {
    id: String(d.id ?? id),
    title: d.name ?? "Unknown",
    image: d.image?.medium_url ?? null,
    year: d.start_year ?? null,
    subtitle: null,
  };
}

export type SearchComicsOut =
  | { results: SearchResult[] }
  | { results: []; requiresApiKey: "comicvine"; link: string; tutorial: string };

export async function searchComics(
  q: string,
  apiKey: string | null | undefined,
  meta: { link: string; tutorial: string },
  sort?: string
): Promise<SearchComicsOut> {
  if (!apiKey?.trim()) {
    return { results: [], requiresApiKey: "comicvine", link: meta.link, tutorial: meta.tutorial };
  }
  const url = buildUrl("/search/", apiKey, {
    query: q,
    resources: "volume",
    limit: "20",
  });
  const res = await fetch(url);
  if (!res.ok) return { results: [] };
  const data = (await res.json()) as {
    status_code?: number;
    results?: Array<{
      id: number;
      name?: string;
      image?: { small_url?: string; medium_url?: string };
      start_year?: string;
    }>;
  };
  if (data.status_code !== 1 || !Array.isArray(data.results)) return { results: [] };
  const list: SearchResult[] = data.results.slice(0, 20).map((item) => ({
    id: String(item.id),
    title: item.name ?? "Unknown",
    image: item.image?.medium_url ?? item.image?.small_url ?? null,
    year: item.start_year ?? null,
    subtitle: null,
  }));
  const results = sortSearchResults(list, sort);
  return { results };
}
