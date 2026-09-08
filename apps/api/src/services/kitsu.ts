import {
  decodeHtmlEntities,
  DEFAULT_ANIME_MANGA_TITLE_LANGUAGE,
  pickAnimeMangaTitle,
  SEARCH_RESULTS_PAGE_SIZE,
  type AnimeMangaTitleLanguage,
  type SearchResult,
} from "@geeklogs/shared";
import { upstreamFetch } from "../lib/upstreamFetch.js";

const BASE = "https://kitsu.io/api/edge";
const KITSU_PAGE_LIMIT = 20;

type KitsuResourceRef = { type?: string; id?: string };

type KitsuMappingAttrs = {
  externalSite?: string | null;
  externalId?: string | null;
};

type KitsuMediaAttrs = {
  nsfw?: boolean | null;
  canonicalTitle?: string | null;
  titles?: {
    en?: string | null;
    en_jp?: string | null;
    ja_jp?: string | null;
  } | null;
  startDate?: string | null;
  averageRating?: string | number | null;
  posterImage?: {
    tiny?: string | null;
    small?: string | null;
    medium?: string | null;
  } | null;
};

type KitsuResource = {
  id?: string;
  type?: string;
  attributes?: KitsuMediaAttrs | KitsuMappingAttrs;
  relationships?: {
    mappings?: { data?: KitsuResourceRef[] };
  };
};

export type KitsuCollectionResponse = {
  data?: KitsuResource[];
  included?: KitsuResource[];
};

function malSiteFor(media: "anime" | "manga"): string {
  return media === "manga" ? "myanimelist/manga" : "myanimelist/anime";
}

function malIdFromMappings(
  item: KitsuResource,
  includedById: Map<string, KitsuResource>,
  media: "anime" | "manga"
): string | null {
  const site = malSiteFor(media);
  for (const ref of item.relationships?.mappings?.data ?? []) {
    if (!ref.id) continue;
    const mapping = includedById.get(ref.id);
    const attrs = (mapping?.attributes ?? {}) as KitsuMappingAttrs;
    if (attrs.externalSite !== site) continue;
    const id = attrs.externalId?.trim();
    if (id && /^\d+$/.test(id) && Number(id) > 0) return id;
  }
  return null;
}

function kitsuScore(raw: string | number | null | undefined): number | null {
  const n = typeof raw === "number" ? raw : raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number((n / 10).toFixed(2));
}

export function kitsuCollectionToSearchResults(
  json: KitsuCollectionResponse,
  media: "anime" | "manga",
  preference: AnimeMangaTitleLanguage = DEFAULT_ANIME_MANGA_TITLE_LANGUAGE,
  max = SEARCH_RESULTS_PAGE_SIZE
): SearchResult[] {
  const includedById = new Map<string, KitsuResource>();
  for (const row of json.included ?? []) {
    if (row.id) includedById.set(row.id, row);
  }
  const out: SearchResult[] = [];
  const seen = new Set<string>();
  for (const item of json.data ?? []) {
    const attrs = (item.attributes ?? {}) as KitsuMediaAttrs;
    if (attrs.nsfw) continue;
    const malId = malIdFromMappings(item, includedById, media);
    if (!malId || seen.has(malId)) continue;
    const titles = attrs.titles ?? {};
    const title = decodeHtmlEntities(
      pickAnimeMangaTitle(
        {
          english: titles.en,
          romaji: titles.en_jp || attrs.canonicalTitle,
          native: titles.ja_jp,
        },
        preference
      )
    );
    const year = attrs.startDate?.slice(0, 4) || null;
    const image =
      attrs.posterImage?.small?.trim() ||
      attrs.posterImage?.tiny?.trim() ||
      attrs.posterImage?.medium?.trim() ||
      null;
    seen.add(malId);
    out.push({
      id: malId,
      title,
      image,
      year,
      subtitle: null,
      score: kitsuScore(attrs.averageRating),
    });
    if (out.length >= max) break;
  }
  return out;
}

async function searchKitsuMedia(
  media: "anime" | "manga",
  q: string,
  preference: AnimeMangaTitleLanguage,
  max: number
): Promise<SearchResult[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const params = new URLSearchParams();
  params.set("filter[text]", trimmed);
  params.set("include", "mappings");
  params.set("page[limit]", String(Math.min(KITSU_PAGE_LIMIT, max)));
  const res = await upstreamFetch(`${BASE}/${media}?${params.toString()}`, {
    provider: "kitsu",
    retry: true,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as KitsuCollectionResponse;
  return kitsuCollectionToSearchResults(json, media, preference, max);
}

export async function searchAnimeKitsu(
  q: string,
  preference: AnimeMangaTitleLanguage = DEFAULT_ANIME_MANGA_TITLE_LANGUAGE,
  max = SEARCH_RESULTS_PAGE_SIZE
): Promise<SearchResult[]> {
  return searchKitsuMedia("anime", q, preference, max);
}

export async function searchMangaKitsu(
  q: string,
  preference: AnimeMangaTitleLanguage = DEFAULT_ANIME_MANGA_TITLE_LANGUAGE,
  max = SEARCH_RESULTS_PAGE_SIZE
): Promise<SearchResult[]> {
  return searchKitsuMedia("manga", q, preference, max);
}
