/**
 * Ludopedia API client.
 * Docs: https://ludopedia.com.br/api/documentacao.html
 * Auth: Bearer token (obtain via Ludopedia OAuth / aplicativos).
 */
import type { SearchResult, ItemDetail } from "@logeverything/shared";
import { sortSearchResults } from "../lib/sortSearchResults.js";

const BASE = "https://ludopedia.com.br/api/v1";

function ludopediaHeaders(apiToken?: string | null): HeadersInit {
  const t = apiToken ?? process.env.LUDOPEDIA_API_TOKEN ?? null;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Logeverything/1.0 (https://github.com/logeverything)",
  };
  if (t) headers["Authorization"] = `Bearer ${t}`;
  return headers;
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
    ? raw.categorias.map((c) => (typeof c === "string" ? c : (c as { nm_categoria?: string }).nm_categoria)).filter(Boolean) as string[]
    : [];
  const mechanics = Array.isArray(raw.mecanicas)
    ? raw.mecanicas.map((m) => (typeof m === "string" ? m : (m as { nm_mecanica?: string }).nm_mecanica)).filter(Boolean) as string[]
    : [];
  const description =
    typeof raw.descricao === "string" ? raw.descricao.replace(/<[^>]+>/g, "").trim().slice(0, 2000) || null : null;
  const image = (raw.thumb ?? raw.url_imagem)?.trim() || null;
  const playersMin = raw.qt_jogadores_min ?? raw.qt_min_jogadores;
  const playersMax = raw.qt_jogadores_max ?? raw.qt_max_jogadores;
  const playingTime = raw.vl_tempo_jogo ?? raw.tempo_jogo;
  return {
    id,
    title: raw.nm_jogo ?? "Unknown",
    image,
    year,
    subtitle: null,
    description: description ?? null,
    playersMin: typeof playersMin === "number" && playersMin > 0 ? playersMin : null,
    playersMax: typeof playersMax === "number" && playersMax > 0 ? playersMax : null,
    playingTimeMinutes: typeof playingTime === "number" && playingTime > 0 ? playingTime : null,
    minAge: typeof raw.idade_minima === "number" && raw.idade_minima > 0 ? raw.idade_minima : null,
    categories: categories.length > 0 ? categories : null,
    mechanics: mechanics.length > 0 ? mechanics : null,
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
  return list.slice(0, 20).map((item) => {
    const image = (item.thumb ?? item.url_imagem)?.trim() || null;
    return {
      id: String(item.id_jogo ?? ""),
      title: item.nm_jogo ?? "Unknown",
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
  params.set("rows", "20");
  params.set("page", "1");

  const url = `${BASE}/jogos?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: ludopediaHeaders(token),
  });
  if (!res.ok) return { results: [] };
  const data = (await res.json()) as JogosResponse;
  const results = parseJogosResponse(data);
  const sorted = sortSearchResults(results, sort) as SearchResult[];
  return { results: sorted };
}
