import {
  decodeHtmlEntities,
  SEARCH_RESULTS_PAGE_SIZE,
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
