/**
 * Ludopedia API client.
 * Docs: https://ludopedia.com.br/api/documentacao.html
 * Auth: Bearer token (obtain via Ludopedia OAuth / aplicativos).
 */
import { decodeHtmlEntities, type SearchResult, type ItemDetail, SEARCH_RESULTS_PAGE_SIZE } from "@geeklogs/shared";
import { sortSearchResults } from "../lib/sortSearchResults.js";
import { InvalidApiKeyError } from "../lib/InvalidApiKeyError.js";

const BASE = "https://ludopedia.com.br/api/v1";

function ludopediaHeaders(apiToken?: string | null): HeadersInit {
  const t = apiToken ?? process.env.LUDOPEDIA_API_TOKEN ?? null;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Geeklogs/1.0 (https://github.com/geeklogs)",
  };
  if (t) headers["Authorization"] = `Bearer ${t}`;
  return headers;
}

function normLogin(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseLudopediaColecaoJson(data: unknown): string[] {
  const objectIds: string[] = [];
  const pushId = (v: unknown) => {
    if (v == null) return;
    if (typeof v === "number" && Number.isFinite(v)) {
      objectIds.push(String(Math.floor(v)));
      return;
    }
    if (typeof v === "string" && v.trim() !== "") objectIds.push(v.trim());
  };
  if (Array.isArray(data)) {
    for (const el of data) {
      if (el != null && typeof el === "object") {
        const o = el as Record<string, unknown>;
        pushId(o.id_jogo ?? o.idJogo);
      }
    }
  } else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const list = (o.jogos ?? o.colecao ?? o.data ?? o.items) as unknown;
    const arr = Array.isArray(list) ? list : [];
    for (const el of arr) {
      if (el != null && typeof el === "object") {
        const row = el as Record<string, unknown>;
        pushId(row.id_jogo ?? row.idJogo);
      }
    }
  }
  return [...new Set(objectIds)];
}

function extractUsuarioRowsFromUsuariosJson(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((x): x is Record<string, unknown> => x != null && typeof x === "object");
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["usuarios", "users", "data", "itens", "resultados", "list"]) {
      const v = o[k];
      if (Array.isArray(v)) {
        return v.filter((x): x is Record<string, unknown> => x != null && typeof x === "object");
      }
    }
  }
  return [];
}

/**
 * Resolves a Ludopedia profile id (best effort via GET /usuarios) to load another member's collection
 * when the API returns matching rows.
 */
async function tryResolveLudopediaUserIdByLogin(
  token: string,
  profileName: string
): Promise<string | null> {
  const want = normLogin(profileName);
  if (want.length === 0) return null;

  const userSearchUrls = [
    `${BASE}/usuarios?search=${encodeURIComponent(profileName.trim())}`,
    `${BASE}/usuarios?nm_apelido=${encodeURIComponent(profileName.trim())}`,
    `${BASE}/usuarios?login=${encodeURIComponent(profileName.trim())}`,
    `${BASE}/usuarios?nm_login=${encodeURIComponent(profileName.trim())}`,
  ];
  for (const url of userSearchUrls) {
    const res = await fetch(url, { headers: ludopediaHeaders(token) });
    if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("ludopedia");
    if (!res.ok) continue;
    const data = (await res.json()) as unknown;
    const rows = extractUsuarioRowsFromUsuariosJson(data);
    for (const row of rows) {
      const idRaw = row.id_usuario ?? row.idUsuario ?? row.id;
      if (idRaw == null || idRaw === "") continue;
      const idStr = String(idRaw);
      const names: string[] = [row.nm_apelido, row.nm_login, row.login, row.nm_usuario, row.username, row.nome].filter(
        (x): x is string => typeof x === "string" && x.trim() !== ""
      );
      for (const n of names) {
        if (normLogin(n) === want) {
          return idStr;
        }
      }
    }
    if (rows.length === 1) {
      const one = rows[0]!;
      const idOnly = one.id_usuario ?? one.idUsuario ?? one.id;
      if (idOnly != null && idOnly !== "") {
        return String(idOnly);
      }
    }
  }
  return null;
}

type ColecaoGetResult =
  | { type: "ok"; data: unknown }
  | { type: "unauth" }
  | { type: "ratelimit" }
  | { type: "server"; status: number }
  | { type: "other"; status: number };

async function getLudopediaColecaoResponse(token: string, pathWithQuery: string): Promise<ColecaoGetResult> {
  const res = await fetch(`${BASE}/${pathWithQuery.replace(/^\//, "")}`, { headers: ludopediaHeaders(token) });
  if (res.status === 401 || res.status === 403) {
    return { type: "unauth" };
  }
  if (res.status === 429) {
    return { type: "ratelimit" };
  }
  if (res.status >= 500) {
    return { type: "server", status: res.status };
  }
  if (!res.ok) {
    return { type: "other", status: res.status };
  }
  return { type: "ok", data: await res.json() };
}

function unauthColecioResult(): { objectIds: string[]; error: string; errorCode: "LUDOPEDIA_UNAUTHORIZED" } {
  return {
    objectIds: [],
    error:
      "Your Ludopedia access token is invalid or expired. Create a new token at Ludopedia (Applications) and add it in Settings, then try again.",
    errorCode: "LUDOPEDIA_UNAUTHORIZED",
  };
}

/**
 * List game ids in a collection for the given public profile (best effort).
 * Uses server or user `LUDOPEDIA_API_TOKEN` in headers; may hit GET /usuarios then GET /colecao?…id_usuario…
 * and falls back to the token owner’s /colecao if no user id was resolved (same as before when only “own” collection existed).
 */
export async function fetchLudopediaColecaoObjectIdsForProfileName(
  apiToken: string,
  profileName: string
): Promise<{ objectIds: string[]; error?: string; errorCode?: string }> {
  const token = apiToken?.trim();
  if (!token) return { objectIds: [], error: "Ludopedia token required", errorCode: "LUDOPEDIA_UNAUTHORIZED" };
  const profile = profileName.trim();
  if (!profile) {
    return { objectIds: [], error: "Enter a Ludopedia profile name to import a collection." };
  }

  let userId: string | null = null;
  try {
    userId = await tryResolveLudopediaUserIdByLogin(token, profile);
  } catch (e) {
    if (e instanceof InvalidApiKeyError) {
      return unauthColecioResult();
    }
    throw e;
  }

  if (userId) {
    const idParams = [
      `id_usuario=${encodeURIComponent(userId)}`,
      `idUsuario=${encodeURIComponent(userId)}`,
    ];
    let sawOkResponse = false;
    for (const q of idParams) {
      const out = await getLudopediaColecaoResponse(token, `colecao?${q}`);
      if (out.type === "unauth") return unauthColecioResult();
      if (out.type === "ratelimit") {
        return {
          objectIds: [],
          error:
            "Ludopedia is rate limiting requests. Wait a few minutes, then try again. Collection imports are limited to once per 24 hours in Geeklogs to protect API quotas.",
          errorCode: "LUDOPEDIA_RATE_LIMIT",
        };
      }
      if (out.type === "server") {
        return {
          objectIds: [],
          error: `Ludopedia is temporarily unavailable (${out.status}). Try again later.`,
          errorCode: "LUDOPEDIA_SERVER_ERROR",
        };
      }
      if (out.type === "ok") {
        sawOkResponse = true;
        const objectIds = parseLudopediaColecaoJson(out.data);
        if (objectIds.length > 0) {
          return { objectIds };
        }
      }
    }
    if (sawOkResponse) {
      return {
        objectIds: [],
        error: "We found that profile on Ludopedia but their collection came back empty (or not visible with your token).",
        errorCode: "LUDOPEDIA_COLECAO_EMPTY",
      };
    }
  }

  return fetchLudopediaColecaoObjectIds(token);
}

/**
 * GET /me — current user (LudoAPI).
 */
export async function fetchLudopediaMe(apiToken: string): Promise<{
  raw: Record<string, unknown>;
  loginLike: string | null;
} | null> {
  const token = apiToken?.trim();
  if (!token) return null;
  const res = await fetch(`${BASE}/me`, { headers: ludopediaHeaders(token) });
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("ludopedia");
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const loginLike =
    [data.login, data.username, data.nm_usuario, data.nm_login, data.nm_apelido]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find((s) => s.length > 0) ?? null;
  return { raw: data, loginLike };
}

/**
 * GET /colecao — collection for the token owner. Doc: LudoAPI Coleção.
 * Response shape may be an array of items with `id_jogo` or an object with `jogos` / `colecao` / `data`.
 */
export async function fetchLudopediaColecaoObjectIds(
  apiToken: string
): Promise<{ objectIds: string[]; error?: string; errorCode?: string }> {
  const token = apiToken?.trim();
  if (!token) return { objectIds: [], error: "Ludopedia token required", errorCode: "LUDOPEDIA_UNAUTHORIZED" };
  const res = await getLudopediaColecaoResponse(token, "colecao");
  if (res.type === "unauth") {
    return unauthColecioResult();
  }
  if (res.type === "ratelimit") {
    return {
      objectIds: [],
      error:
        "Ludopedia is rate limiting requests. Wait a few minutes, then try again. Collection imports are limited to once per 24 hours in Geeklogs to protect API quotas.",
      errorCode: "LUDOPEDIA_RATE_LIMIT",
    };
  }
  if (res.type === "server") {
    return {
      objectIds: [],
      error: `Ludopedia is temporarily unavailable (${res.status}). Try again later.`,
      errorCode: "LUDOPEDIA_SERVER_ERROR",
    };
  }
  if (res.type === "other") {
    return {
      objectIds: [],
      error: `We couldn’t load your Ludopedia collection (HTTP ${res.status}). If this keeps happening, check Ludopedia’s status and your token in Settings.`,
      errorCode: "LUDOPEDIA_UNKNOWN",
    };
  }
  const objectIds = parseLudopediaColecaoJson(res.data);
  return { objectIds };
}

/**
 * Map Ludopedia GET /jogos/{id_jogo} response to ItemDetail.
 * Doc: id_jogo, nm_jogo, thumb, ano_publicacao, qt_jogadores_min/max, vl_tempo_jogo,
 * idade_minima, categorias (Jogo_categorias[]), mecanicas (Jogo_mecanicas[]).
 */
function mapJogoToItemDetail(raw: {
  id_jogo?: number | string;
  nm_jogo?: string;
  ano_publicacao?: number | string;
  url_imagem?: string | null;
  thumb?: string | null;
  descricao?: string | null;
  qt_jogadores_min?: number | null;
  qt_jogadores_max?: number | null;
  qt_min_jogadores?: number | null;
  qt_max_jogadores?: number | null;
  vl_tempo_jogo?: number | null;
  tempo_jogo?: number | null;
  idade_minima?: number | null;
  categorias?: string[] | { nm_categoria?: string }[];
  mecanicas?: string[] | { nm_mecanica?: string }[];
}): ItemDetail {
  const id = raw.id_jogo != null ? String(raw.id_jogo) : "";
  const year = raw.ano_publicacao != null ? String(raw.ano_publicacao).slice(0, 4) : null;
  const categories = Array.isArray(raw.categorias)
    ? (raw.categorias
        .map((c) => (typeof c === "string" ? c : (c as { nm_categoria?: string }).nm_categoria))
        .filter(Boolean) as string[]
    ).map((c) => decodeHtmlEntities(c))
    : [];
  const mechanics = Array.isArray(raw.mecanicas)
    ? (raw.mecanicas
        .map((m) => (typeof m === "string" ? m : (m as { nm_mecanica?: string }).nm_mecanica))
        .filter(Boolean) as string[]
    ).map((m) => decodeHtmlEntities(m))
    : [];
  const descriptionRaw =
    typeof raw.descricao === "string" ? raw.descricao.replace(/<[^>]+>/g, "").trim().slice(0, 2000) || null : null;
  const description = descriptionRaw ? decodeHtmlEntities(descriptionRaw) : null;
  const thumb = raw.thumb?.trim() || null;
  const full = raw.url_imagem?.trim() || null;
  const playersMin = raw.qt_jogadores_min ?? raw.qt_min_jogadores;
  const playersMax = raw.qt_jogadores_max ?? raw.qt_max_jogadores;
  const playingTime = raw.vl_tempo_jogo ?? raw.tempo_jogo;
  const genres = categories.length > 0 ? categories : null;
  return {
    id,
    title: decodeHtmlEntities(raw.nm_jogo ?? "Unknown"),
    image: full,
    thumbnail: thumb,
    year,
    subtitle: null,
    description: description ?? null,
    playersMin: typeof playersMin === "number" && playersMin > 0 ? playersMin : null,
    playersMax: typeof playersMax === "number" && playersMax > 0 ? playersMax : null,
    playingTimeMinutes: typeof playingTime === "number" && playingTime > 0 ? playingTime : null,
    minAge: typeof raw.idade_minima === "number" && raw.idade_minima > 0 ? raw.idade_minima : null,
    categories: categories.length > 0 ? categories : null,
    mechanics: mechanics.length > 0 ? mechanics : null,
    genres,
  };
}

export async function getBoardGameByIdLudopedia(
  id: string,
  apiToken?: string | null
): Promise<ItemDetail | null> {
  const token = apiToken ?? process.env.LUDOPEDIA_API_TOKEN;
  if (!token) return null;
  const res = await fetch(`${BASE}/jogos/${encodeURIComponent(id)}`, {
    headers: ludopediaHeaders(token),
  });
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("ludopedia");
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  return mapJogoToItemDetail(data as Parameters<typeof mapJogoToItemDetail>[0]);
}

export type SearchBoardGamesLudopediaResult =
  | { results: SearchResult[] }
  | { results: []; requiresApiKey: "ludopedia"; link: string; tutorial: string };

type JogoItem = {
  id_jogo?: number | string;
  nm_jogo?: string;
  ano_publicacao?: number | string;
  url_imagem?: string | null;
  thumb?: string | null;
};

type JogosResponse = {
  jogos?: JogoItem[];
  itens?: JogoItem[];
  resultados?: JogoItem[];
};

function parseJogosResponse(data: JogosResponse): SearchResult[] {
  const list = data.jogos ?? data.itens ?? data.resultados ?? [];
  return list.slice(0, SEARCH_RESULTS_PAGE_SIZE).map((item) => {
    const image = (item.thumb ?? item.url_imagem)?.trim() || null;
    return {
      id: String(item.id_jogo ?? ""),
      title: decodeHtmlEntities(item.nm_jogo ?? "Unknown"),
      image,
      year: item.ano_publicacao != null ? String(item.ano_publicacao).slice(0, 4) : null,
      subtitle: null,
    };
  });
}

/**
 * Ludopedia search: GET /api/v1/jogos with query param "search" (nome do jogo),
 * tp_jogo=b (jogo base), optional page and rows (1–100, default 20).
 */
export async function searchBoardGamesLudopedia(
  q: string,
  apiToken?: string | null,
  meta?: { link: string; tutorial: string },
  sort?: string
): Promise<SearchBoardGamesLudopediaResult> {
  const token = apiToken ?? process.env.LUDOPEDIA_API_TOKEN;
  if (!token) {
    return meta
      ? { results: [], requiresApiKey: "ludopedia", link: meta.link, tutorial: meta.tutorial }
      : { results: [] };
  }
  const searchTerm = q.trim();
  if (!searchTerm) return { results: [] };

  const params = new URLSearchParams();
  params.set("search", searchTerm);
  params.set("tp_jogo", "b");
  params.set("rows", String(SEARCH_RESULTS_PAGE_SIZE));
  params.set("page", "1");

  const url = `${BASE}/jogos?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: ludopediaHeaders(token),
  });
  if (res.status === 401 || res.status === 403) throw new InvalidApiKeyError("ludopedia");
  if (!res.ok) return { results: [] };
  const data = (await res.json()) as JogosResponse;
  const results = parseJogosResponse(data);
  const sorted = sortSearchResults(results, sort) as SearchResult[];
  return { results: sorted };
}
