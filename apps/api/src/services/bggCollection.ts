import { XMLParser } from "fast-xml-parser";
import { bggHeaders } from "./bgg.js";

const BASE = "https://boardgamegeek.com/xmlapi2";

export type BggCollectionErrorCode =
  | "BGG_USER_NOT_FOUND"
  | "BGG_RATE_LIMIT"
  | "BGG_INVALID_USERNAME"
  | "BGG_SERVER_ERROR"
  | "BGG_STILL_LOADING"
  | "BGG_UNKNOWN";

/**
 * BGG XML API2 collection: https://boardgamegeek.com/wiki/page/BGG_XML_API2#collection
 * Returns 202 while building; retry with delay.
 */
export async function fetchBggCollectionObjectIds(
  username: string,
  apiToken?: string | null
): Promise<{
  objectIds: string[];
  error?: string;
  errorCode?: BggCollectionErrorCode;
}> {
  const u = username.trim();
  if (!u) return { objectIds: [], error: "BGG username is required", errorCode: "BGG_INVALID_USERNAME" };

  const params = new URLSearchParams();
  params.set("username", u);
  params.set("subtype", "boardgame");
  params.set("own", "1");
  params.set("excludesubtype", "boardgameexpansion");

  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${BASE}/collection?${params.toString()}`, {
      headers: bggHeaders(apiToken),
    });
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (res.status === 404) {
      return {
        objectIds: [],
        error:
          "We couldn’t find a BoardGameGeek account with that username. Check the spelling, or use the name shown on your BGG profile.",
        errorCode: "BGG_USER_NOT_FOUND",
      };
    }
    if (res.status === 429) {
      return {
        objectIds: [],
        error:
          "BoardGameGeek is rate limiting requests. Wait a few minutes, then try again. To protect daily quotas, collection imports are limited to once per 24 hours in Geeklogs.",
        errorCode: "BGG_RATE_LIMIT",
      };
    }
    if (res.status >= 500) {
      return {
        objectIds: [],
        error: `BoardGameGeek is temporarily unavailable (${res.status}). Try again later.`,
        errorCode: "BGG_SERVER_ERROR",
      };
    }
    if (!res.ok) {
      return {
        objectIds: [],
        error: `We couldn’t load that collection from BoardGameGeek (HTTP ${res.status}). Check your BGG account and try again later.`,
        errorCode: "BGG_UNKNOWN",
      };
    }
    const xml = await res.text();
    const lower = xml.toLowerCase();
    if (lower.includes("invalid username") || lower.includes("invalid specif")) {
      return {
        objectIds: [],
        error:
          "We couldn’t find a BoardGameGeek account with that username. Check the spelling, or use the name shown on your BGG profile.",
        errorCode: "BGG_USER_NOT_FOUND",
      };
    }
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml) as {
      items?: { item?: unknown; "@_totalitems"?: string };
    };

    const bggError = parseBggXmlError(xml, parsed);
    if (bggError) {
      if (bggError.code === "invalid" || bggError.code === "username" || bggError.message.toLowerCase().includes("user")) {
        return {
          objectIds: [],
          error:
            "We couldn’t find a BoardGameGeek account with that username. Check the spelling, or use the name shown on your BGG profile.",
          errorCode: "BGG_USER_NOT_FOUND",
        };
      }
      return {
        objectIds: [],
        error: bggError.message,
        errorCode: "BGG_INVALID_USERNAME",
      };
    }

    const items = parsed.items?.item;
    if (items == null) {
      return { objectIds: [] };
    }
    const list = Array.isArray(items) ? items : [items];
    const objectIds: string[] = [];
    for (const row of list) {
      if (row == null || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = o["@_objectid"];
      if (id != null && String(id).trim() !== "") objectIds.push(String(id));
    }
    return { objectIds };
  }
  return {
    objectIds: [],
    error: "BGG is still building this collection. Wait a few minutes, then use Import again (if your last import was more than 24 hours ago).",
    errorCode: "BGG_STILL_LOADING",
  };
}

function parseBggXmlError(
  _xml: string,
  parsed: { items?: { item?: unknown; "@_totalitems"?: string } }
): { message: string; code: string } | null {
  const p = parsed as unknown as Record<string, unknown>;
  if (p.error) {
    const e = p.error;
    if (typeof e === "string") {
      return { message: e, code: "error" };
    }
    if (typeof e === "object" && e != null) {
      const o = e as Record<string, unknown>;
      const m = o["#text"] ?? o["@_message"] ?? o["message"] ?? o["@_text"];
      if (typeof m === "string" && m.trim() !== "") return { message: m, code: "error" };
    }
  }
  return null;
}
