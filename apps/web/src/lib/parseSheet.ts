/**
 * Parse CSV or XLSX sheet into rows of string records.
 * Requires at least a "Name" column (case-insensitive). Optional: review/comment, rate/grade.
 */

const DEFAULT_MAX_ROWS = 100;
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1MB

export interface ParseSheetOptions {
  /** Max data rows (excluding header). Omit or use a high value for no effective cap (e.g. admin). */
  maxRows?: number;
}

// Column header aliases for EN, PT-BR, ES so imports work in all three languages
const NAME_ALIASES = [
  "name",
  "title",
  "nome",
  "título",
  "titulo",
  "nombre",
  "nome do item",
  "nombre del artículo",
];
const REVIEW_ALIASES = [
  "review",
  "reviews",
  "comment",
  "comments",
  "review/comment",
  "review comment",
  "resenha",
  "reseña",
  "comentario",
  "comentarios",
  "notas",
];
const GRADE_ALIASES = [
  "rate",
  "rating",
  "grade",
  "grade/rate",
  "nota",
  "notas",
  "calificación",
  "calificacion",
  "score",
  "nota (0-10)",
  "rate (0-10)",
];
const STATUS_ALIASES = [
  "status",
  "state",
  "status/state",
  "estado",
  "situação",
  "situacao",
];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Trim and collapse multiple spaces so caps/whitespace in file don't break matching or display. */
function normalizeCell(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export interface ParsedRow {
  name: string;
  review: string | null;
  grade: number | null;
  /** Raw status from file (e.g. "watched", "plan to watch"). Validated against allowed options per category when importing. */
  status: string | null;
}

export type SheetParseResult =
  | {
      ok: true;
      rows: ParsedRow[];
      columns: { name: string; review: string | null; grade: string | null; status: string | null };
    }
  | { ok: false; error: string };

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const n = normalizeHeader(headers[i]);
    if (aliases.some((a) => n === a || n.includes(a))) return i;
  }
  return -1;
}

function parseGrade(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const s = value.trim().replace(/,/, ".");
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  if (n < 0 || n > 10) return null;
  return Math.round(n * 10) / 10; // one decimal
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
      reader.onerror = () =>
        resolve({ ok: false, error: "Failed to read file." });
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
      reader.onerror = () =>
        resolve({ ok: false, error: "Failed to read file." });
      reader.readAsArrayBuffer(file);
    });
  }

  return Promise.resolve({
    ok: false,
    error: "Unsupported format. Use CSV or XLSX.",
  });
}

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

  const reviewIdx = findColumnIndex(rawHeaders, REVIEW_ALIASES);
  const gradeIdx = findColumnIndex(rawHeaders, GRADE_ALIASES);
  const statusIdx = findColumnIndex(rawHeaders, STATUS_ALIASES);

  const dataRows = rows.slice(1);
  const parsed: ParsedRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const name = normalizeCell(String(row[nameIdx] ?? ""));
    if (!name) continue;
    const review =
      reviewIdx >= 0 ? normalizeCell(String(row[reviewIdx] ?? "")) || null : null;
    const grade =
      gradeIdx >= 0 ? parseGrade(String(row[gradeIdx] ?? "")) : null;
    const status =
      statusIdx >= 0 ? normalizeCell(String(row[statusIdx] ?? "")) || null : null;
    parsed.push({ name, review, grade, status });
  }

  if (parsed.length === 0) {
    return { ok: false, error: "No rows with a name found." };
  }

  return {
    ok: true,
    rows: parsed,
    columns: {
      name: rawHeaders[nameIdx] ?? "Name",
      review: reviewIdx >= 0 ? (rawHeaders[reviewIdx] ?? null) : null,
      grade: gradeIdx >= 0 ? (rawHeaders[gradeIdx] ?? null) : null,
      status: statusIdx >= 0 ? (rawHeaders[statusIdx] ?? null) : null,
    },
  };
}
