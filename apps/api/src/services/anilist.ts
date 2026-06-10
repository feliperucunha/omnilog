import {
  decodeHtmlEntities,
  SEARCH_RESULTS_PAGE_SIZE,
  type ItemDetail,
  type SearchResult,
} from "@geeklogs/shared";

const ANILIST_URL = "https://graphql.anilist.co";

type AnilistTitle = {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
};

type AnilistMediaRow = {
  idMal?: number | null;
  title?: AnilistTitle | null;
  coverImage?: { medium?: string | null } | null;
  startDate?: { year?: number | null } | null;
  averageScore?: number | null;
};

function queryHasCjk(text: string): boolean {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(text);
}

function pickAnilistDetailTitle(title: AnilistTitle): string {
  const english = title.english?.trim();
  const romaji = title.romaji?.trim();
  const native = title.native?.trim();
  return decodeHtmlEntities(english || romaji || native || "Unknown");
}

function anilistDescription(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const stripped = raw.replace(/<[^>]+>/g, "").trim().slice(0, 2000);
  return stripped ? decodeHtmlEntities(stripped) : null;
}

async function anilistGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) return null;
  return json.data ?? null;
}

export function pickAnilistDisplayTitle(title: AnilistTitle, query: string): string {
  const romaji = title.romaji?.trim();
  const english = title.english?.trim();
  const native = title.native?.trim();
  if (queryHasCjk(query)) {
    return native || english || romaji || "Unknown";
  }
  return english || romaji || native || "Unknown";
}

function anilistRowToSearchResult(row: AnilistMediaRow, query: string): SearchResult | null {
  if (row.idMal == null || row.idMal <= 0) return null;
  const title = row.title ?? {};
  const label = decodeHtmlEntities(pickAnilistDisplayTitle(title, query));
  const score =
    typeof row.averageScore === "number" && row.averageScore > 0
      ? row.averageScore / 10
      : null;
  const year = row.startDate?.year != null ? String(row.startDate.year) : null;
  return {
    id: String(row.idMal),
    title: label,
    image: row.coverImage?.medium?.trim() || null,
    year,
    subtitle: null,
    score,
  };
}

export async function searchAnimeAnilist(
  q: string,
  perPage = SEARCH_RESULTS_PAGE_SIZE
): Promise<SearchResult[]> {
  const query = `query ($search: String, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
        idMal
        title { romaji english native }
        coverImage { medium }
        startDate { year }
        averageScore
      }
    }
  }`;

  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { search: q.trim(), perPage } }),
  });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    data?: { Page?: { media?: AnilistMediaRow[] } };
    errors?: unknown[];
  };
  if (json.errors?.length) return [];

  const out: SearchResult[] = [];
  const seen = new Set<string>();
  for (const row of json.data?.Page?.media ?? []) {
    const hit = anilistRowToSearchResult(row, q);
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    out.push(hit);
    if (out.length >= perPage) break;
  }
  return out;
}

type AnilistDetailMedia = {
  idMal?: number | null;
  title?: AnilistTitle | null;
  coverImage?: { large?: string | null; medium?: string | null } | null;
  description?: string | null;
  averageScore?: number | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  duration?: number | null;
  startDate?: { year?: number | null } | null;
  genres?: string[] | null;
  studios?: { nodes?: Array<{ name?: string | null }> } | null;
  tags?: Array<{ name?: string | null; category?: string | null }> | null;
};

async function getMediaDetailAnilist(
  id: string,
  type: "ANIME" | "MANGA"
): Promise<ItemDetail | null> {
  const idMal = parseInt(id, 10);
  if (!Number.isFinite(idMal) || idMal <= 0) return null;

  const query = `query ($idMal: Int, $type: MediaType) {
    Media(idMal: $idMal, type: $type) {
      idMal
      title { romaji english native }
      coverImage { large medium }
      description(asHtml: false)
      averageScore
      episodes
      chapters
      volumes
      duration
      startDate { year }
      genres
      studios(isMain: true) { nodes { name } }
      tags { name category }
    }
  }`;

  const data = await anilistGraphql<{ Media?: AnilistDetailMedia | null }>(query, {
    idMal,
    type,
  });
  const d = data?.Media;
  if (!d?.idMal) return null;

  const score =
    typeof d.averageScore === "number" && d.averageScore > 0 ? d.averageScore / 10 : null;
  const year = d.startDate?.year != null ? String(d.startDate.year) : null;
  const genres = d.genres
    ?.map((g) => g?.trim())
    .filter(Boolean)
    .map((g) => decodeHtmlEntities(g as string));
  const themes =
    type === "ANIME"
      ? (d.tags ?? [])
          .filter((t) => t.category === "Theme")
          .map((t) => t.name?.trim())
          .filter(Boolean)
          .map((n) => decodeHtmlEntities(n as string))
      : (d.tags ?? [])
          .filter((t) => t.category === "Theme")
          .map((t) => t.name?.trim())
          .filter(Boolean)
          .map((n) => decodeHtmlEntities(n as string));
  const demographics =
    type === "MANGA"
      ? (d.tags ?? [])
          .filter((t) => t.category === "Demographic")
          .map((t) => t.name?.trim())
          .filter(Boolean)
          .map((n) => decodeHtmlEntities(n as string))
      : [];
  const studios =
    type === "ANIME"
      ? (d.studios?.nodes ?? [])
          .map((s) => s.name?.trim())
          .filter(Boolean)
          .map((n) => decodeHtmlEntities(n as string))
      : [];

  const base: ItemDetail = {
    id: String(d.idMal),
    title: pickAnilistDetailTitle(d.title ?? {}),
    image: d.coverImage?.large?.trim() || d.coverImage?.medium?.trim() || null,
    year,
    subtitle: null,
    description: anilistDescription(d.description),
    score,
    genres: genres?.length ? genres : null,
    themes: themes.length ? themes : null,
  };

  if (type === "ANIME") {
    return {
      ...base,
      episodesCount: (d.episodes ?? 0) > 0 ? d.episodes! : null,
      studios: studios.length ? studios : null,
      duration:
        typeof d.duration === "number" && d.duration > 0
          ? `${d.duration} min per ep`
          : null,
    };
  }

  return {
    ...base,
    chaptersCount: (d.chapters ?? 0) > 0 ? d.chapters! : null,
    volumesCount: (d.volumes ?? 0) > 0 ? d.volumes! : null,
    demographics: demographics.length ? demographics : null,
  };
}

export async function getAnimeByIdAnilist(id: string): Promise<ItemDetail | null> {
  return getMediaDetailAnilist(id, "ANIME");
}

export async function getMangaByIdAnilist(id: string): Promise<ItemDetail | null> {
  return getMediaDetailAnilist(id, "MANGA");
}
