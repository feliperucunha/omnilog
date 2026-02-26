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

/** Map Ludopedia jogo response to ItemDetail. Adapt fields to match actual API response. */
function mapJogoToItemDetail(raw: {
  id_jogo?: number | string;
  nm_jogo?: string;
  ano_publicacao?: number | string;
  url_imagem?: string | null;
  descricao?: string | null;
  qt_min_jogadores?: number | null;
  qt_max_jogadores?: number | null;
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
  return {
    id,
    title: raw.nm_jogo ?? "Unknown",
    image: raw.url_imagem?.trim() || null,
    year,
    subtitle: null,
    description: description ?? null,
    playersMin: typeof raw.qt_min_jogadores === "number" && raw.qt_min_jogadores > 0 ? raw.qt_min_jogadores : null,
    playersMax: typeof raw.qt_max_jogadores === "number" && raw.qt_max_jogadores > 0 ? raw.qt_max_jogadores : null,
    playingTimeMinutes:
      typeof raw.tempo_jogo === "number" && raw.tempo_jogo > 0 ? raw.tempo_jogo : null,
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
  const params = new URLSearchParams();
  params.set("termo", q.trim());
  params.set("tp_jogo", "b");
  const res = await fetch(`${BASE}/jogos?${params.toString()}`, {
    headers: ludopediaHeaders(token),
  });
  if (!res.ok) return { results: [] };
  const data = (await res.json()) as {
    jogos?: Array<{
      id_jogo?: number | string;
      nm_jogo?: string;
      ano_publicacao?: number | string;
      url_imagem?: string | null;
    }>;
    itens?: Array<{ id_jogo?: number; nm_jogo?: string; ano_publicacao?: number; url_imagem?: string }>;
  };
  const list = data.jogos ?? data.itens ?? [];
  const results: SearchResult[] = list.slice(0, 20).map((item) => ({
    id: String(item.id_jogo ?? ""),
    title: item.nm_jogo ?? "Unknown",
    image: item.url_imagem?.trim() || null,
    year: item.ano_publicacao != null ? String(item.ano_publicacao).slice(0, 4) : null,
    subtitle: null,
  }));
  const sorted = sortSearchResults(results, sort) as SearchResult[];
  return { results: sorted };
}
