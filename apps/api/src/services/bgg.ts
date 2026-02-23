import { XMLParser } from "fast-xml-parser";
import type { SearchResult, ItemDetail } from "@logeverything/shared";

const BASE = "https://boardgamegeek.com/xmlapi2";

function bggHeaders(token?: string | null): HeadersInit {
  const t = token ?? process.env.BGG_API_TOKEN;
  const headers: HeadersInit = {
    "User-Agent": "Logeverything/1.0 (https://github.com/logeverything)",
  };
  if (t) headers["Authorization"] = `Bearer ${t}`;
  return headers;
}

export async function getBoardGameById(id: string, apiToken?: string | null): Promise<ItemDetail | null> {
  const token = apiToken ?? process.env.BGG_API_TOKEN;
  if (!token) return null;
  const res = await fetch(`${BASE}/thing?id=${id}`, { headers: bggHeaders(token) });
  if (!res.ok) return null;
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as {
    items?: {
      item?: {
        "@_id": string;
        name?: { "#text": string; "@_type"?: string } | Array<{ "#text": string; "@_type"?: string }>;
        yearpublished?: { "@_value"?: string };
        image?: string;
      };
    };
  };
  const item = parsed.items?.item;
  if (!item || Array.isArray(item)) return null;
  const names = item.name;
  let title = "Unknown";
  if (Array.isArray(names)) {
    const primary = names.find((n) => n["@_type"] === "primary") ?? names[0];
    title = primary?.["#text"] ?? "Unknown";
  } else if (names?.["#text"]) title = names["#text"];
  const year = item.yearpublished?.["@_value"] ?? null;
  return {
    id: item["@_id"],
    title,
    image: item.image ?? null,
    year,
    subtitle: null,
  };
}

export type SearchBoardGamesResult =
  | { results: SearchResult[] }
  | { results: []; requiresApiKey: "bgg"; link: string; tutorial: string };

export async function searchBoardGames(
  q: string,
  apiToken?: string | null,
  meta?: { link: string; tutorial: string }
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
  const thingRes = await fetch(`${BASE}/thing?id=${ids}`, { headers: bggHeaders(token) });
  if (!thingRes.ok) return { results: [] };
  const thingXml = await thingRes.text();
  const thingParsed = parser.parse(thingXml) as {
    items?: {
      item?: Array<{
        "@_id": string;
        name?: { "#text": string; "@_type"?: string } | Array<{ "#text": string; "@_type"?: string }>;
        yearpublished?: { "@_value"?: string };
        image?: string;
      }>;
    };
  };
  const rawItems = thingParsed.items?.item;
  const thingItems = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  if (thingItems.length === 0) return { results: [] };

  const results = thingItems.map((item) => {
    const names = item.name;
    let title = "Unknown";
    if (Array.isArray(names)) {
      const primary = names.find((n) => n["@_type"] === "primary") ?? names[0];
      title = primary?.["#text"] ?? "Unknown";
    } else if (names?.["#text"]) {
      title = names["#text"];
    }
    const year = (item as { yearpublished?: { "@_value"?: string } }).yearpublished?.["@_value"] ?? null;
    return {
      id: item["@_id"],
      title,
      image: item.image ?? null,
      year,
      subtitle: null,
    };
  });
  return { results };
}
