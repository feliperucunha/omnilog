import { XMLParser } from "fast-xml-parser";
import type { SearchResult, ItemDetail } from "@geeklogs/shared";
import { sortSearchResults } from "../lib/sortSearchResults.js";
import { InvalidApiKeyError } from "../lib/InvalidApiKeyError.js";

const BASE = "https://boardgamegeek.com/xmlapi2";

/**
 * Coerce BGG `<image>` / `<thumbnail>` XML nodes to a single URL string.
 * fast-xml-parser variants seen in the wild:
 * - plain string
 * - `{ "#text": "url", "@_attr": "..." }` when the element has attributes
 * - array of strings when multiple sibling tags share the same name
 * - `{ "@_href": "url" }` or similar when the URL is attribute-only (no text node)
 */
function normalizeBggHttpUrl(s: string): string | null {
  let t = s.trim();
  if (!t) return null;
  if (t.startsWith("//")) t = `https:${t}`;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return null;
}

/** Exported for unit tests; also handles all BGG XML shapes for image/thumbnail. */
export function bggExtractImageUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    return normalizeBggHttpUrl(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeBggHttpUrl(String(value));
  }
  if (Array.isArray(value)) {
    for (const el of value) {
      const u = bggExtractImageUrl(el);
      if (u) return u;
    }
    return null;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if ("#text" in o) {
      const u = bggExtractImageUrl(o["#text"]);
      if (u) return u;
    }
    const attrKeys = ["@_href", "@_src", "@_value", "href", "src", "value"] as const;
    for (const k of attrKeys) {
      const v = o[k];
      if (typeof v === "string") {
        const u = normalizeBggHttpUrl(v);
        if (u) return u;
      }
    }
  }
  return null;
}

/** Single `/thing?id=` responses sometimes parse `item` as a one-element array. */
function bggNormalizeThingItem<T>(item: T | T[] | undefined): T | null {
  if (item == null) return null;
  if (Array.isArray(item)) return item.length > 0 ? (item[0] ?? null) : null;
  return item;
}

function bggReadNumericXmlNode(node: unknown): number | null {
  if (node == null || typeof node !== "object") return null;
  const o = node as Record<string, unknown>;
  const raw = o["@_value"] ?? o["#text"];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** BGG `statistics.ratings.averageweight` when `stats=1` on thing. */
function bggExtractAverageWeight(item: Record<string, unknown>): number | null {
  const statsRaw = item.statistics;
  const stats = Array.isArray(statsRaw) ? statsRaw[0] : statsRaw;
  if (!stats || typeof stats !== "object") return null;
  const ratingsRaw = (stats as { ratings?: unknown }).ratings;
  const ratings = Array.isArray(ratingsRaw) ? ratingsRaw[0] : ratingsRaw;
  if (!ratings || typeof ratings !== "object") return null;
  const aw = (ratings as { averageweight?: unknown }).averageweight;
  const n = bggReadNumericXmlNode(aw);
  if (n == null) return null;
  return Math.round(n * 1000) / 1000;
}

/** BGG `statistics.ratings.bayesaverage` (community rank-style score, often ~0–10). */
function bggExtractBayesAverage(item: Record<string, unknown>): number | null {
  const statsRaw = item.statistics;
  const stats = Array.isArray(statsRaw) ? statsRaw[0] : statsRaw;
  if (!stats || typeof stats !== "object") return null;
  const ratingsRaw = (stats as { ratings?: unknown }).ratings;
  const ratings = Array.isArray(ratingsRaw) ? ratingsRaw[0] : ratingsRaw;
  if (!ratings || typeof ratings !== "object") return null;
  const ba = (ratings as { bayesaverage?: unknown }).bayesaverage;
  const n = bggReadNumericXmlNode(ba);
  if (n == null || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function bggHeaders(token?: string | null): HeadersInit {
  const t = token ?? process.env.BGG_API_TOKEN;
  const headers: HeadersInit = {
    "User-Agent": "Geeklogs/1.0 (https://github.com/geeklogs)",
  };
  if (t) headers["Authorization"] = `Bearer ${t}`;
  return headers;
}

export async function getBoardGameById(id: string, apiToken?: string | null): Promise<ItemDetail | null> {
  const token = apiToken ?? process.env.BGG_API_TOKEN;
  if (!token) return null;
  const res = await fetch(`${BASE}/thing?id=${id}&stats=1`, { headers: bggHeaders(token) });
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("bgg");
  if (!res.ok) return null;
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as {
    items?: {
      item?: {
        "@_id": string;
        name?: { "#text"?: string; "@_value"?: string; "@_type"?: string } | Array<{ "#text"?: string; "@_value"?: string; "@_type"?: string }>;
        yearpublished?: { "@_value"?: string };
        image?: string | { "#text"?: string };
        thumbnail?: string | { "#text"?: string };
        description?: string;
        minplayers?: { "@_value"?: string };
        maxplayers?: { "@_value"?: string };
        playingtime?: { "@_value"?: string };
        minage?: { "@_value"?: string };
        link?: { "@_type": string; "@_value": string } | Array<{ "@_type": string; "@_value": string }>;
      };
    };
  };
  const item = bggNormalizeThingItem(parsed.items?.item);
  if (!item) return null;
  const itemRec = item as unknown as Record<string, unknown>;
  const names = item.name;
  const getTitle = (n: { "#text"?: string; "@_value"?: string } | undefined): string =>
    (n?.["@_value"] ?? n?.["#text"] ?? "Unknown").trim() || "Unknown";
  let title = "Unknown";
  if (Array.isArray(names)) {
    const primary = names.find((n) => n["@_type"] === "primary") ?? names[0];
    title = getTitle(primary);
  } else if (names) {
    title = getTitle(names);
  }
  const year = item.yearpublished?.["@_value"] ?? null;
  const rawDesc = item.description;
  const description =
    typeof rawDesc === "string" ? rawDesc.replace(/<[^>]+>/g, "").trim().slice(0, 2000) || null : null;
  const minP = item.minplayers?.["@_value"];
  const maxP = item.maxplayers?.["@_value"];
  const playTime = item.playingtime?.["@_value"];
  const minVal = minP != null && minP !== "" ? parseInt(minP, 10) : null;
  const maxVal = maxP != null && maxP !== "" ? parseInt(maxP, 10) : null;
  const timeVal = playTime != null && playTime !== "" ? parseInt(playTime, 10) : null;
  const minAgeVal = item.minage?.["@_value"];
  const minAge = minAgeVal != null && minAgeVal !== "" ? parseInt(minAgeVal, 10) : null;
  const links = item.link;
  const linkList = Array.isArray(links) ? links : links ? [links] : [];
  const categories = linkList.filter((l) => l["@_type"] === "boardgamecategory").map((l) => l["@_value"]).filter(Boolean) as string[];
  const mechanics = linkList.filter((l) => l["@_type"] === "boardgamemechanic").map((l) => l["@_value"]).filter(Boolean) as string[];
  const genres = categories.length > 0 ? categories : null;
  const fullImage = bggExtractImageUrl(item.image);
  const thumbImage = bggExtractImageUrl(item.thumbnail);
  const averageWeight = bggExtractAverageWeight(itemRec);
  return {
    id: item["@_id"],
    title,
    image: fullImage,
    thumbnail: thumbImage,
    year,
    subtitle: null,
    description: description ?? null,
    playersMin: minVal != null && !Number.isNaN(minVal) ? minVal : null,
    playersMax: maxVal != null && !Number.isNaN(maxVal) ? maxVal : null,
    playingTimeMinutes: timeVal != null && !Number.isNaN(timeVal) ? timeVal : null,
    minAge: minAge != null && !Number.isNaN(minAge) ? minAge : null,
    averageWeight: averageWeight != null && averageWeight > 0 ? averageWeight : null,
    categories: categories.length > 0 ? categories : null,
    mechanics: mechanics.length > 0 ? mechanics : null,
    genres,
  };
}

export type SearchBoardGamesResult =
  | { results: SearchResult[] }
  | { results: []; requiresApiKey: "bgg"; link: string; tutorial: string };

export async function searchBoardGames(
  q: string,
  apiToken?: string | null,
  meta?: { link: string; tutorial: string },
  sort?: string
): Promise<SearchBoardGamesResult> {
  const token = apiToken ?? process.env.BGG_API_TOKEN;
  if (!token) {
    return meta
      ? { results: [], requiresApiKey: "bgg", link: meta.link, tutorial: meta.tutorial }
      : { results: [] };
  }
  const res = await fetch(
    `${BASE}/search?query=${encodeURIComponent(q)}&type=boardgame`,
    { headers: bggHeaders(token) }
  );
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("bgg");
  if (!res.ok) return { results: [] };
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as {
    items?: { item?: Array<{ "@_id": string; name?: { "@_value": string } | Array<{ "@_value": string }> }> };
  };
  const items = parsed.items?.item;
  const itemsList = Array.isArray(items) ? items : items ? [items] : [];
  if (itemsList.length === 0) return { results: [] };

  const ids = itemsList.slice(0, 20).map((i) => i["@_id"]).join(",");
  const thingRes = await fetch(`${BASE}/thing?id=${ids}&stats=1`, { headers: bggHeaders(token) });
  if (thingRes.status === 401 || thingRes.status === 403) throw new InvalidApiKeyError("bgg");
  if (!thingRes.ok) return { results: [] };
  const thingXml = await thingRes.text();
  const thingParsed = parser.parse(thingXml) as {
    items?: {
      item?: Array<{
        "@_id": string;
        name?: { "#text"?: string; "@_value"?: string; "@_type"?: string } | Array<{ "#text"?: string; "@_value"?: string; "@_type"?: string }>;
        yearpublished?: { "@_value"?: string };
        image?: string | { "#text"?: string };
        thumbnail?: string | { "#text"?: string };
      }>;
    };
  };
  const rawItems = thingParsed.items?.item;
  const thingItems = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  if (thingItems.length === 0) return { results: [] };

  const getTitle = (n: { "#text"?: string; "@_value"?: string } | undefined): string =>
    (n?.["@_value"] ?? n?.["#text"] ?? "Unknown").trim() || "Unknown";
  let results = thingItems.map((item) => {
    const names = item.name;
    let title = "Unknown";
    if (Array.isArray(names)) {
      const primary = names.find((n) => n["@_type"] === "primary") ?? names[0];
      title = getTitle(primary);
    } else if (names) {
      title = getTitle(names);
    }
    const year = (item as { yearpublished?: { "@_value"?: string } }).yearpublished?.["@_value"] ?? null;
    const row = item as { image?: unknown; thumbnail?: unknown };
    const itemRec = item as unknown as Record<string, unknown>;
    const score = bggExtractBayesAverage(itemRec);
    return {
      id: item["@_id"],
      title,
      image: bggExtractImageUrl(row.image) ?? bggExtractImageUrl(row.thumbnail),
      year,
      subtitle: null,
      score: score != null ? score : null,
    };
  });
  const sorted = sortSearchResults(results, sort) as typeof results;
  return { results: sorted };
}
