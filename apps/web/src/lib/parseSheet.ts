/**
 * Parse CSV or XLSX into rows. Requires a title column (Name / Title / …).
 * Optional columns map to log fields; headers are matched case-insensitively with many aliases.
 */

import { boardGameOwnershipToBooleans, type BoardGameOwnership } from "@/lib/boardGameOwnership";
import { normalizeSheetLocaleToken } from "@/lib/batchSheetStatusResolve";
import en from "@/locales/en.json";
import ptBR from "@/locales/pt-BR.json";
import es from "@/locales/es.json";

const LIST_TYPE_LOOKUP: Map<string, "favorites" | "pending"> = (() => {
  const m = new Map<string, "favorites" | "pending">();
  const put = (raw: string | undefined, v: "favorites" | "pending") => {
    if (!raw?.trim()) return;
    const k = normalizeSheetLocaleToken(raw);
    if (!m.has(k)) m.set(k, v);
  };
  for (const pack of [en, ptBR, es] as const) {
    const st = pack.status;
    if (st?.favorites) put(st.favorites, "favorites");
    if (st?.pending) put(st.pending, "pending");
  }
  put("favorites", "favorites");
  put("favourite", "favorites");
  put("favorite", "favorites");
  put("favoritos", "favorites");
  put("pending", "pending");
  put("pendente", "pending");
  put("pendientes", "pending");
  put("backlog", "pending");
  return m;
})();

const OWNERSHIP_PHRASE_TO_MODE: Map<string, BoardGameOwnership> = (() => {
  const m = new Map<string, BoardGameOwnership>();
  const put = (raw: string | undefined, mode: BoardGameOwnership) => {
    if (!raw?.trim()) return;
    const k = normalizeSheetLocaleToken(raw);
    if (!m.has(k)) m.set(k, mode);
  };
  for (const pack of [en, ptBR, es] as const) {
    const ir = pack.itemReviewForm;
    if (!ir) continue;
    put(ir.doNotOwn, "doNotOwn");
    put(ir.wantToBuy, "wantToBuy");
    put(ir.own, "own");
    put(ir.sold, "sold");
  }
  put("do not own", "doNotOwn");
  put("don't own", "doNotOwn");
  put("dont own", "doNotOwn");
  put("want to buy", "wantToBuy");
  put("wishlist", "wantToBuy");
  put("owned", "own");
  put("sold", "sold");
  return m;
})();

const DEFAULT_MAX_ROWS = 100;
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1MB

export interface ParseSheetOptions {
  /** Max data rows (excluding header). Omit or use a high value for no effective cap (e.g. admin). */
  maxRows?: number;
}

const NAME_ALIASES = [
  "name",
  "title",
  "nome",
  "título",
  "titulo",
  "nombre",
  "nome do item",
  "nombre del artículo",
  "item",
  "work",
  "obra",
  "título da obra",
  "movie",
  "film",
  "filme",
  "película",
  "pelicula",
  "show",
  "series",
  "série",
  "serie",
  "game",
  "jogo",
  "juego",
  "book",
  "livro",
  "libro",
  "anime",
  "manga",
  "comic",
  "hq",
  "board game",
  "boardgame",
  "jogo de tabuleiro",
  "juego de mesa",
];

const REVIEW_ALIASES = [
  "review",
  "reviews",
  "comment",
  "comments",
  "review/comment",
  "review comment",
  "notes",
  "note",
  "resenha",
  "reseña",
  "comentario",
  "comentarios",
  "opinion",
  "thoughts",
  "impressions",
  "critique",
  "synopsis",
  "summary",
];

const GRADE_ALIASES = [
  "rate",
  "rating",
  "grade",
  "grade/rate",
  "score",
  "stars",
  "nota",
  "calificación",
  "calificacion",
  "puntuación",
  "puntuacion",
  "avaliação",
  "avaliacao",
  "valuation",
  "nota (0-10)",
  "nota (0–10)",
  "rate (0-10)",
  "rate (0–10)",
  "grade (0-10)",
  "score (0-10)",
];

const STATUS_ALIASES = [
  "status",
  "state",
  "status/state",
  "estado",
  "situação",
  "situacao",
  "situation",
  "watch status",
  "reading status",
  "game status",
  "progress",
];

const SEASON_ALIASES = [
  "season",
  "temporada",
  "season number",
  "número da temporada",
  "numero da temporada",
  "temporada nº",
];

const EPISODE_ALIASES = [
  "episode",
  "ep",
  "ep.",
  "episódio",
  "episodio",
  "chapter (tv)",
  "capítulo (tv)",
  "capitulo (tv)",
];

const CHAPTER_ALIASES = [
  "chapter",
  "capítulo",
  "capitulo",
  "ch",
  "ch.",
  "manga chapter",
  "comic chapter",
];

const VOLUME_ALIASES = [
  "volume",
  "vol",
  "vol.",
  "tomo",
  "tankōbon",
  "tankobon",
];

const CONTENT_HOURS_ALIASES = [
  "content hours",
  "contenthours",
  "hours watched",
  "hours read",
  "hours listened",
  "runtime hours",
  "length hours",
  "duration hours",
  "horas assistidas",
  "horas de contenido",
  "tempo (horas)",
  "time hours",
];

const HOURS_TO_BEAT_ALIASES = [
  "hours to beat",
  "hourstobeat",
  "htb",
  "time to beat",
  "ttb",
  "beat time",
  "completion time hours",
  "horas para zerar",
  "horas para completar",
  "tiempo de juego",
];

const MATCHES_PLAYED_ALIASES = [
  "matches played",
  "matchesplayed",
  "plays",
  "play count",
  "sessions",
  "partidas",
  "sessões",
  "sesiones",
  "times played",
  "vezes jogado",
];

const OWN_ALIASES = ["own", "owned", "i own", "possuo", "tenho", "tengo"];

const WANT_TO_BUY_ALIASES = [
  "want to buy",
  "wanttobuy",
  "wtb",
  "wishlist",
  "wish list",
  "lista de desejos",
  "quiero comprar",
  "quero comprar",
];

const SOLD_ALIASES = ["sold", "vendido", "no longer own", "vendi"];

/** Single column: pick one mode (matches BoardGameOwnershipSwitch). */
const OWNERSHIP_COMBINED_ALIASES = [
  "ownership",
  "collection",
  "copia",
  "cópia",
  "coleção",
  "colecao",
  "coleccion",
  "colección",
  "propiedad",
  "property",
  "copy status",
];

const PURCHASE_AMOUNT_ALIASES = [
  "purchaseamountminor",
  "purchase amount",
  "purchase price",
  "price paid",
  "paid",
  "cost",
  "bought for",
  "preço pago",
  "preco pago",
  "precio compra",
  "valor pago",
  "amount paid",
];

const PURCHASE_CURRENCY_ALIASES = [
  "purchasecurrency",
  "purchase currency",
  "price currency",
  "paid currency",
  "cost currency",
  "moeda compra",
  "moneda compra",
];

const SALE_AMOUNT_ALIASES = [
  "saleamountminor",
  "sale amount",
  "sale proceeds",
  "proceeds",
  "sold for",
  "valor venda",
  "precio venta",
  "sale price",
];

const SALE_CURRENCY_ALIASES = [
  "salecurrency",
  "sale currency",
  "proceeds currency",
  "moneda venta",
  "moeda venda",
];

const LIST_TYPE_ALIASES = ["list type", "listtype", "tipo de lista"];

const GENRES_ALIASES = [
  "genres",
  "genre",
  "gêneros",
  "generos",
  "géneros",
  "categories",
  "tags",
];

const MECHANICS_ALIASES = [
  "mechanics",
  "mechanic",
  "mecânicas",
  "mecanicas",
  "board game mechanics",
];

export interface ParsedRow {
  name: string;
  review: string | null;
  grade: number | null;
  /** Raw status from file; validated per category when importing. */
  status: string | null;
  season: number | null;
  episode: number | null;
  chapter: number | null;
  volume: number | null;
  contentHours: number | null;
  hoursToBeat: number | null;
  own: boolean | null;
  wantToBuy: boolean | null;
  sold: boolean | null;
  matchesPlayed: number | null;
  purchaseAmountMinor: number | null;
  purchaseCurrency: string | null;
  saleAmountMinor: number | null;
  saleCurrency: string | null;
  listType: string | null;
  genres: string[] | null;
  mechanics: string[] | null;
}

export type SheetParseResult =
  | {
      ok: true;
      rows: ParsedRow[];
      columns: Record<string, string | null>;
    }
  | { ok: false; error: string };

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Trim and collapse multiple spaces. */
function normalizeCell(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Longer aliases first so e.g. "purchase amount" wins over "amount" if both existed. */
function findColumnIndex(headers: string[], aliases: string[]): number {
  const sorted = [...aliases].sort((a, b) => b.length - a.length);
  for (let i = 0; i < headers.length; i++) {
    const n = normalizeHeader(headers[i]);
    for (const a of sorted) {
      const al = a.toLowerCase();
      if (n === al) return i;
      // Avoid single-letter / tiny substring false positives
      if (al.length >= 3 && n.includes(al)) return i;
    }
  }
  return -1;
}

function parseGrade(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const s = value.trim().replace(/,/, ".");
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  if (n < 0 || n > 10) return null;
  return Math.round(n * 10) / 10;
}

function parseOptionalInt(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = parseInt(String(value).trim().replace(/,/g, ""), 10);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function parseOptionalNonNegFloat(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const s = value.trim().replace(/,/, ".");
  const n = parseFloat(s);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 1000) / 1000;
}

/** Minor units if integer; otherwise treat as major units (e.g. 24.99 → 2499). */
function parseAmountMinor(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const s = value.trim().replace(/\s/g, "").replace(",", ".");
  if (/^-?\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isNaN(n) || n < 0) return null;
    return n;
  }
  const f = parseFloat(s);
  if (Number.isNaN(f) || f < 0) return null;
  return Math.round(f * 100);
}

function parseCurrency(value: string | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  const c = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (c.length === 3) return c;
  return null;
}

function parseBooleanCell(value: string | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  const n = normalizeCell(String(value)).toLowerCase();
  const trueSet = new Set([
    "yes",
    "y",
    "true",
    "1",
    "sim",
    "si",
    "sí",
    "verdadeiro",
    "verdadero",
    "x",
    "v",
    "oui",
    "ja",
    "já",
    "da",
  ]);
  const falseSet = new Set([
    "no",
    "n",
    "false",
    "0",
    "não",
    "nao",
    "non",
    "falso",
    "f",
    "nee",
  ]);
  if (trueSet.has(n)) return true;
  if (falseSet.has(n)) return false;
  return null;
}

function parseListCell(value: string | undefined): string[] | null {
  if (value == null || !normalizeCell(String(value))) return null;
  const raw = String(value);
  const parts = raw
    .split(/[\n,;|]+|\s+[/／]\s+|\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts.slice(0, 20) : null;
}

function parseOwnershipCombined(value: string | undefined): {
  own: boolean | null;
  wantToBuy: boolean | null;
  sold: boolean | null;
} | null {
  if (value == null || !normalizeCell(String(value))) return null;
  const token = normalizeSheetLocaleToken(normalizeCell(String(value)));
  const fromLocale = OWNERSHIP_PHRASE_TO_MODE.get(token);
  if (fromLocale) {
    const b = boardGameOwnershipToBooleans(fromLocale);
    return { own: b.own, wantToBuy: b.wantToBuy, sold: b.sold };
  }
  const n = normalizeCell(String(value)).toLowerCase();
  const compact = n.replace(/[\s_\-]+/g, "");

  const byCompact: Record<string, BoardGameOwnership> = {
    donotown: "doNotOwn",
    dontown: "doNotOwn",
    none: "doNotOwn",
    na: "doNotOwn",
    wanttobuy: "wantToBuy",
    wishlist: "wantToBuy",
    wtb: "wantToBuy",
    own: "own",
    owned: "own",
    yes: "own",
    sold: "sold",
    vendido: "sold",
  };
  let mode: BoardGameOwnership | undefined = byCompact[compact];
  if (!mode) {
    if (/\bunsold\b|\bnot\s+sold\b/i.test(n)) mode = "doNotOwn";
    else if (/\b(sold|vendido)\b/.test(n)) mode = "sold";
    else if (n.includes("want to buy") || n.includes("wishlist") || /\bwtb\b/.test(n)) mode = "wantToBuy";
    else if (
      (n.includes("do not own") || n.includes("don't own") || n.includes("dont own") || n.includes("no tengo")) &&
      !n.includes("want")
    )
      mode = "doNotOwn";
    else if (/\b(own|owned)\b/.test(n) && !n.includes("do not") && !n.includes("don't") && !n.includes("dont"))
      mode = "own";
    else if (n === "possuo" || n === "tenho" || n === "tengo") mode = "own";
    else mode = "doNotOwn";
  }

  const b = boardGameOwnershipToBooleans(mode);
  return { own: b.own, wantToBuy: b.wantToBuy, sold: b.sold };
}

function parseListType(value: string | undefined): string | null {
  if (value == null || !normalizeCell(String(value))) return null;
  const k = normalizeSheetLocaleToken(normalizeCell(String(value)));
  return LIST_TYPE_LOOKUP.get(k) ?? null;
}

/** Parse CSV string (handles quoted fields). */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQuotes) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((x) => x.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += c;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

export function parseSheetFile(file: File, options?: ParseSheetOptions): Promise<SheetParseResult> {
  if (file.size > MAX_FILE_BYTES) {
    return Promise.resolve({
      ok: false,
      error: "File too large. Maximum size is 1MB.",
    });
  }

  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();

  if (ext === "csv" || file.type === "text/csv") {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = (reader.result as string) ?? "";
        const rows = parseCSV(text);
        resolve(parseSheetRows(rows, maxRows));
      };
      reader.onerror = () => resolve({ ok: false, error: "Failed to read file." });
      reader.readAsText(file, "UTF-8");
    });
  }

  if (ext === "xlsx" || ext === "xls" || file.type.includes("spreadsheet")) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const XLSX = await import("xlsx");
          const data = new Uint8Array(reader.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" } as const);
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          if (!firstSheet) {
            resolve({ ok: false, error: "No sheet found in file." });
            return;
          }
          const json: string[][] = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            defval: "",
            raw: false,
          }) as string[][];
          resolve(parseSheetRows(json, maxRows));
        } catch (e) {
          resolve({
            ok: false,
            error: e instanceof Error ? e.message : "Failed to parse Excel file.",
          });
        }
      };
      reader.onerror = () => resolve({ ok: false, error: "Failed to read file." });
      reader.readAsArrayBuffer(file);
    });
  }

  return Promise.resolve({
    ok: false,
    error: "Unsupported format. Use CSV or XLSX.",
  });
}

const COLUMN_KEYS = [
  "name",
  "status",
  "grade",
  "review",
  "season",
  "episode",
  "chapter",
  "volume",
  "contentHours",
  "hoursToBeat",
  "matchesPlayed",
  "ownershipCombined",
  "own",
  "wantToBuy",
  "sold",
  "purchaseAmountMinor",
  "purchaseCurrency",
  "saleAmountMinor",
  "saleCurrency",
  "listType",
  "genres",
  "mechanics",
] as const;

function parseSheetRows(rows: string[][], maxRows: number = DEFAULT_MAX_ROWS): SheetParseResult {
  if (rows.length === 0) {
    return { ok: false, error: "Sheet is empty." };
  }
  if (Number.isFinite(maxRows) && rows.length > maxRows + 1) {
    return { ok: false, error: `Too many rows. Maximum is ${maxRows} data rows.` };
  }

  const rawHeaders = rows[0].map((h) => normalizeCell(String(h ?? "")));
  const nameIdx = findColumnIndex(rawHeaders, NAME_ALIASES);
  if (nameIdx < 0) {
    return {
      ok: false,
      error: 'Sheet must have a "Name" (or "Title") column.',
    };
  }

  const idx = {
    review: findColumnIndex(rawHeaders, REVIEW_ALIASES),
    grade: findColumnIndex(rawHeaders, GRADE_ALIASES),
    status: findColumnIndex(rawHeaders, STATUS_ALIASES),
    season: findColumnIndex(rawHeaders, SEASON_ALIASES),
    episode: findColumnIndex(rawHeaders, EPISODE_ALIASES),
    chapter: findColumnIndex(rawHeaders, CHAPTER_ALIASES),
    volume: findColumnIndex(rawHeaders, VOLUME_ALIASES),
    contentHours: findColumnIndex(rawHeaders, CONTENT_HOURS_ALIASES),
    hoursToBeat: findColumnIndex(rawHeaders, HOURS_TO_BEAT_ALIASES),
    matchesPlayed: findColumnIndex(rawHeaders, MATCHES_PLAYED_ALIASES),
    ownershipCombined: findColumnIndex(rawHeaders, OWNERSHIP_COMBINED_ALIASES),
    own: findColumnIndex(rawHeaders, OWN_ALIASES),
    wantToBuy: findColumnIndex(rawHeaders, WANT_TO_BUY_ALIASES),
    sold: findColumnIndex(rawHeaders, SOLD_ALIASES),
    purchaseAmountMinor: findColumnIndex(rawHeaders, PURCHASE_AMOUNT_ALIASES),
    purchaseCurrency: findColumnIndex(rawHeaders, PURCHASE_CURRENCY_ALIASES),
    saleAmountMinor: findColumnIndex(rawHeaders, SALE_AMOUNT_ALIASES),
    saleCurrency: findColumnIndex(rawHeaders, SALE_CURRENCY_ALIASES),
    listType: findColumnIndex(rawHeaders, LIST_TYPE_ALIASES),
    genres: findColumnIndex(rawHeaders, GENRES_ALIASES),
    mechanics: findColumnIndex(rawHeaders, MECHANICS_ALIASES),
  };

  const columns: Record<string, string | null> = {};
  for (const key of COLUMN_KEYS) {
    if (key === "name") {
      columns.name = rawHeaders[nameIdx] ?? "Name";
      continue;
    }
    const i = idx[key as keyof typeof idx];
    columns[key] = i >= 0 ? (rawHeaders[i] ?? null) : null;
  }

  const dataRows = rows.slice(1);
  const parsed: ParsedRow[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const name = normalizeCell(String(row[nameIdx] ?? ""));
    if (!name) continue;

    let own: boolean | null = idx.own >= 0 ? parseBooleanCell(String(row[idx.own] ?? "")) : null;
    let wantToBuy: boolean | null =
      idx.wantToBuy >= 0 ? parseBooleanCell(String(row[idx.wantToBuy] ?? "")) : null;
    let sold: boolean | null = idx.sold >= 0 ? parseBooleanCell(String(row[idx.sold] ?? "")) : null;

    if (idx.ownershipCombined >= 0) {
      const combined = parseOwnershipCombined(String(row[idx.ownershipCombined] ?? ""));
      if (combined) {
        own = combined.own;
        wantToBuy = combined.wantToBuy;
        sold = combined.sold;
      }
    }

    parsed.push({
      name,
      review:
        idx.review >= 0 ? normalizeCell(String(row[idx.review] ?? "")) || null : null,
      grade: idx.grade >= 0 ? parseGrade(String(row[idx.grade] ?? "")) : null,
      status:
        idx.status >= 0 ? normalizeCell(String(row[idx.status] ?? "")) || null : null,
      season: idx.season >= 0 ? parseOptionalInt(String(row[idx.season] ?? "")) : null,
      episode: idx.episode >= 0 ? parseOptionalInt(String(row[idx.episode] ?? "")) : null,
      chapter: idx.chapter >= 0 ? parseOptionalInt(String(row[idx.chapter] ?? "")) : null,
      volume: idx.volume >= 0 ? parseOptionalInt(String(row[idx.volume] ?? "")) : null,
      contentHours:
        idx.contentHours >= 0 ? parseOptionalNonNegFloat(String(row[idx.contentHours] ?? "")) : null,
      hoursToBeat:
        idx.hoursToBeat >= 0 ? parseOptionalNonNegFloat(String(row[idx.hoursToBeat] ?? "")) : null,
      own,
      wantToBuy,
      sold,
      matchesPlayed:
        idx.matchesPlayed >= 0 ? parseOptionalInt(String(row[idx.matchesPlayed] ?? "")) : null,
      purchaseAmountMinor:
        idx.purchaseAmountMinor >= 0
          ? parseAmountMinor(String(row[idx.purchaseAmountMinor] ?? ""))
          : null,
      purchaseCurrency:
        idx.purchaseCurrency >= 0 ? parseCurrency(String(row[idx.purchaseCurrency] ?? "")) : null,
      saleAmountMinor:
        idx.saleAmountMinor >= 0 ? parseAmountMinor(String(row[idx.saleAmountMinor] ?? "")) : null,
      saleCurrency:
        idx.saleCurrency >= 0 ? parseCurrency(String(row[idx.saleCurrency] ?? "")) : null,
      listType: idx.listType >= 0 ? parseListType(String(row[idx.listType] ?? "")) : null,
      genres: idx.genres >= 0 ? parseListCell(String(row[idx.genres] ?? "")) : null,
      mechanics: idx.mechanics >= 0 ? parseListCell(String(row[idx.mechanics] ?? "")) : null,
    });
  }

  if (parsed.length === 0) {
    return { ok: false, error: "No rows with a name found." };
  }

  return {
    ok: true,
    rows: parsed,
    columns,
  };
}
