import {
  decodeHtmlEntities,
  SEARCH_RESULTS_PAGE_SIZE,
  type ItemDetail,
  type SearchResult,
} from "@geeklogs/shared";
import { InvalidApiKeyError } from "../lib/InvalidApiKeyError.js";
import { UpstreamUnavailableError } from "../lib/UpstreamUnavailableError.js";
import { upstreamFetch } from "../lib/upstreamFetch.js";

const BASE = "https://api.igdb.com/v4";
const TOKEN_ENDPOINT = "https://id.twitch.tv/oauth2/token";
const EXTERNAL_ID_PREFIX = "igdb:";
const LIST_FIELDS = "name,first_release_date,cover.url,genres.name,rating,total_rating";
const DETAIL_FIELDS =
  "name,first_release_date,cover.url,genres.name,platforms.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,total_rating,rating,aggregated_rating,summary,storyline,themes.name,keywords.name";

type IgdbNamed = { name?: string };
type IgdbGameRow = {
  id?: number;
  name?: string;
  first_release_date?: number;
  cover?: { url?: string };
  genres?: IgdbNamed[];
  platforms?: IgdbNamed[];
  involved_companies?: Array<{
    developer?: boolean;
    publisher?: boolean;
    company?: IgdbNamed;
  }>;
  themes?: IgdbNamed[];
  keywords?: IgdbNamed[];
  summary?: string;
  storyline?: string;
  rating?: number;
  aggregated_rating?: number;
  total_rating?: number;
};
type IgdbTimeToBeatRow = {
  game_id?: number;
  normally?: number;
};
type IgdbGenreRow = {
  id?: number;
  genres?: Array<number | { id?: number }>;
};
type IgdbPopularityRow = {
  game_id?: number;
};

type IgdbCredentials = {
  clientId: string;
  clientSecret: string;
  accessToken: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;
let tokenPromise: Promise<string> | null = null;

function credentials(): IgdbCredentials {
  return {
    clientId: (process.env.IGDB_CLIENT_ID ?? process.env.TWITCH_CLIENT_ID ?? "").trim(),
    clientSecret: (process.env.IGDB_CLIENT_SECRET ?? process.env.TWITCH_CLIENT_SECRET ?? "").trim(),
    accessToken: (process.env.IGDB_ACCESS_TOKEN ?? process.env.IGDB_API_KEY ?? "").trim(),
  };
}

export function isIgdbConfigured(): boolean {
  const { clientId, clientSecret, accessToken } = credentials();
  return !!clientId && (!!clientSecret || !!accessToken);
}

export function toIgdbExternalId(id: number): string {
  return `${EXTERNAL_ID_PREFIX}${id}`;
}

export function parseIgdbExternalId(id: string): number | null {
  const match = /^igdb:(\d+)$/.exec(id.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isIgdbExternalId(id: string): boolean {
  return parseIgdbExternalId(id) != null;
}

function escapeQueryString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
}

function namedValues(values: IgdbNamed[] | undefined): string[] | null {
  const names = (values ?? [])
    .map((value) => value.name?.trim())
    .filter((value): value is string => !!value)
    .map((value) => decodeHtmlEntities(value));
  const unique = [...new Set(names)];
  return unique.length ? unique : null;
}

function firstPositive(...values: Array<number | undefined>): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function imageUrl(url: string | undefined): string | null {
  if (!url) return null;
  let value = url.trim();
  if (!value) return null;
  if (value.startsWith("//")) value = `https:${value}`;
  else if (value.startsWith("http://")) value = `https://${value.slice(7)}`;
  return value.replace(/\/t_[^/]+\//, "/t_cover_big/");
}

function releaseDate(row: IgdbGameRow): string | null {
  if (typeof row.first_release_date !== "number" || row.first_release_date <= 0) return null;
  return new Date(row.first_release_date * 1000).toISOString().slice(0, 10);
}

function description(row: IgdbGameRow): string | null {
  const value = (row.summary ?? row.storyline)?.trim();
  return value ? decodeHtmlEntities(value) : null;
}

function listScore(row: IgdbGameRow): number | null {
  const rating = firstPositive(row.rating, row.total_rating, row.aggregated_rating);
  return rating == null ? null : Math.round((rating / 20) * 10) / 10;
}

function detailScore(row: IgdbGameRow): number | null {
  const rating = firstPositive(row.total_rating, row.rating, row.aggregated_rating);
  return rating == null ? null : Math.round((rating / 10) * 10) / 10;
}

function timeToBeatHours(row: IgdbTimeToBeatRow | undefined): number | null {
  const seconds = row?.normally;
  if (typeof seconds !== "number" || seconds <= 0) return null;
  return Math.round((seconds / 3600) * 10) / 10;
}

export function mapIgdbGameToSearchResult(row: IgdbGameRow): SearchResult {
  const date = releaseDate(row);
  const genres = namedValues(row.genres);
  return {
    id: row.id != null ? toIgdbExternalId(row.id) : "",
    title: decodeHtmlEntities(row.name?.trim() || "Unknown"),
    image: imageUrl(row.cover?.url),
    year: date?.slice(0, 4) ?? null,
    subtitle: null,
    timeToBeatHours: null,
    genres: genres ?? undefined,
    score: listScore(row),
  };
}

export function mapIgdbGameToItemDetail(
  row: IgdbGameRow,
  timeToBeat?: IgdbTimeToBeatRow
): ItemDetail {
  const date = releaseDate(row);
  const companies = row.involved_companies ?? [];
  const developers = namedValues(
    companies
      .filter((company) => company.developer)
      .map((company) => company.company)
      .filter((company): company is IgdbNamed => !!company)
  );
  const publishers = namedValues(
    companies
      .filter((company) => company.publisher)
      .map((company) => company.company)
      .filter((company): company is IgdbNamed => !!company)
  );
  const tags = namedValues([...(row.themes ?? []), ...(row.keywords ?? [])]);
  return {
    id: row.id != null ? toIgdbExternalId(row.id) : "",
    title: decodeHtmlEntities(row.name?.trim() || "Unknown"),
    image: imageUrl(row.cover?.url),
    year: date?.slice(0, 4) ?? null,
    subtitle: null,
    timeToBeatHours: timeToBeatHours(timeToBeat),
    description: description(row),
    genres: namedValues(row.genres),
    score: detailScore(row),
    platforms: namedValues(row.platforms),
    releaseDate: date,
    developers,
    publishers,
    esrbRating: null,
    tags,
  };
}

function sortClause(sort: string | undefined): string | null {
  switch (sort) {
    case "released_desc":
      return "first_release_date desc";
    case "released_asc":
      return "first_release_date asc";
    case "rating_desc":
      return "total_rating desc";
    case "name_asc":
      return "name asc";
    case "name_desc":
      return "name desc";
    default:
      return null;
  }
}

export function buildIgdbSearchQuery(q: string, sort?: string): string {
  const escaped = escapeQueryString(q);
  const order = sortClause(sort);
  const parts = order
    ? [
        `fields ${LIST_FIELDS}`,
        `where name ~ *"${escaped}"* & version_parent = null`,
        `sort ${order}`,
      ]
    : [
        `search "${escaped}"`,
        `fields ${LIST_FIELDS}`,
        "where version_parent = null",
      ];
  parts.push(`limit ${Math.min(40, SEARCH_RESULTS_PAGE_SIZE)}`);
  return `${parts.join("; ")};`;
}

async function fetchAccessToken(): Promise<string> {
  const { clientId, clientSecret, accessToken } = credentials();
  if (!clientId || !clientSecret) {
    if (accessToken) return accessToken;
    throw new InvalidApiKeyError("igdb");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  let res: Response;
  try {
    res = await upstreamFetch(`${TOKEN_ENDPOINT}?${params.toString()}`, {
      method: "POST",
      provider: "igdb",
      retry: true,
    });
  } catch {
    throw new UpstreamUnavailableError("igdb");
  }

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new InvalidApiKeyError("igdb");
  }
  if (!res.ok) throw new UpstreamUnavailableError("igdb");

  const data = (await res.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number }
    | null;
  if (!data?.access_token) throw new UpstreamUnavailableError("igdb");

  const ttlSeconds =
    typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 3600;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, ttlSeconds - 60) * 1000,
  };
  return data.access_token;
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  const { clientId, clientSecret, accessToken } = credentials();
  if (!clientId) throw new InvalidApiKeyError("igdb");
  if (!clientSecret && accessToken && !forceRefresh) return accessToken;
  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  if (!tokenPromise) {
    tokenPromise = fetchAccessToken().finally(() => {
      tokenPromise = null;
    });
  }
  return tokenPromise;
}

async function igdbRequest<T>(
  endpoint: string,
  body: string,
  canRetryAuth = true
): Promise<T> {
  const { clientId, clientSecret } = credentials();
  if (!clientId) throw new InvalidApiKeyError("igdb");

  const send = async (token: string): Promise<Response> => {
    try {
      return await upstreamFetch(`${BASE}/${endpoint}`, {
        method: "POST",
        provider: "igdb",
        retry: true,
        headers: {
          Accept: "application/json",
          "Content-Type": "text/plain",
          "Client-ID": clientId,
          Authorization: `Bearer ${token}`,
        },
        body,
      });
    } catch {
      throw new UpstreamUnavailableError("igdb");
    }
  };

  let res = await send(await getAccessToken());

  if (res.status === 401 && canRetryAuth && clientSecret) {
    cachedToken = null;
    res = await send(await getAccessToken(true));
  }

  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("igdb");
  if (res.status === 429 || res.status >= 500) throw new UpstreamUnavailableError("igdb");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`IGDB ${endpoint} request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

export async function searchIgdbGames(q: string, sort?: string): Promise<SearchResult[]> {
  const rows = await igdbRequest<IgdbGameRow[]>("games", buildIgdbSearchQuery(q, sort));
  return rows.map(mapIgdbGameToSearchResult);
}

export async function getIgdbGameById(id: string | number): Promise<ItemDetail | null> {
  if (!isIgdbConfigured()) return null;
  const rawId = typeof id === "number" ? id : parseIgdbExternalId(id);
  if (rawId == null) return null;

  const [rows, timeRows] = await Promise.all([
    igdbRequest<IgdbGameRow[]>(
      "games",
      `fields ${DETAIL_FIELDS}; where id = ${rawId}; limit 1;`
    ),
    igdbRequest<IgdbTimeToBeatRow[]>(
      "game_time_to_beats",
      `fields game_id,normally; where game_id = ${rawId}; limit 1;`
    ).catch((err) => {
      if (err instanceof InvalidApiKeyError) throw err;
      return [];
    }),
  ]);

  const row = rows[0];
  return row ? mapIgdbGameToItemDetail(row, timeRows[0]) : null;
}

export async function getIgdbGamesRecommendationsFromSeedsViaGenres(
  seedGameIds: string[],
  exclude: Set<string>,
  maxResults: number,
  maxSeeds = 4
): Promise<SearchResult[]> {
  const seedIds = seedGameIds
    .map((id) => parseIgdbExternalId(id))
    .filter((id): id is number => id != null)
    .slice(0, maxSeeds);
  if (seedIds.length === 0) return [];

  const seedRows = await igdbRequest<IgdbGenreRow[]>(
    "games",
    `fields genres; where id = (${seedIds.join(",")}); limit ${seedIds.length};`
  );
  const genreIds = new Set<number>();
  for (const row of seedRows) {
    for (const genre of row.genres ?? []) {
      const id = typeof genre === "number" ? genre : genre.id;
      if (typeof id === "number" && id > 0) genreIds.add(id);
    }
  }
  const genreIdList = [...genreIds].slice(0, 6);
  if (genreIdList.length === 0) return [];

  const rows = await igdbRequest<IgdbGameRow[]>(
    "games",
    `fields ${LIST_FIELDS}; where genres = (${genreIdList.join(",")}) & version_parent = null & total_rating != null; sort total_rating desc; limit ${Math.min(40, Math.max(maxResults * 3, 20))};`
  );

  const excludes = (row: IgdbGameRow): boolean => {
    if (row.id == null) return true;
    const id = toIgdbExternalId(row.id);
    return (
      exclude.has(id) ||
      exclude.has(String(row.id)) ||
      seedGameIds.includes(id) ||
      seedGameIds.includes(String(row.id))
    );
  };

  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const row of rows) {
    if (row.id == null) continue;
    if (excludes(row)) continue;
    const id = toIgdbExternalId(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(mapIgdbGameToSearchResult(row));
    if (out.length >= maxResults) break;
  }
  return out;
}

export async function getIgdbPopularGames(max = 12): Promise<SearchResult[]> {
  const rows = await igdbRequest<IgdbGameRow[]>(
    "games",
    `fields ${LIST_FIELDS}; where version_parent = null & total_rating != null; sort total_rating desc; limit ${max};`
  );
  return rows.map(mapIgdbGameToSearchResult);
}

export async function getIgdbTrendingGames(max = 12): Promise<SearchResult[]> {
  const popularity = await igdbRequest<IgdbPopularityRow[]>(
    "popularity_primitives",
    `fields game_id,value; where popularity_type = 2; sort value desc; limit ${max};`
  );
  const ids = [
    ...new Set(
      popularity
        .map((row) => row.game_id)
        .filter((id): id is number => typeof id === "number" && id > 0)
    ),
  ];
  if (ids.length === 0) return getIgdbPopularGames(max);

  const rows = await igdbRequest<IgdbGameRow[]>(
    "games",
    `fields ${LIST_FIELDS}; where id = (${ids.join(",")}) & version_parent = null; limit ${ids.length};`
  );
  const byId = new Map<number, IgdbGameRow>();
  for (const row of rows) {
    if (row.id != null) byId.set(row.id, row);
  }
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is IgdbGameRow => !!row)
    .map(mapIgdbGameToSearchResult)
    .slice(0, max);
}

export async function getIgdbNewReleasesGames(max = 12): Promise<SearchResult[]> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await igdbRequest<IgdbGameRow[]>(
    "games",
    `fields ${LIST_FIELDS}; where first_release_date != null & first_release_date <= ${now} & version_parent = null; sort first_release_date desc; limit ${max};`
  );
  return rows.map(mapIgdbGameToSearchResult);
}
