import type { MediaType } from "@geeklogs/shared";
import { LOG_STATUS_OPTIONS, STATUS_I18N_KEYS } from "@geeklogs/shared";
import en from "@/locales/en.json";
import ptBR from "@/locales/pt-BR.json";
import es from "@/locales/es.json";

const VIDEO_MEDIA_TYPES: MediaType[] = ["movies", "tv", "anime"];

function getLocaleStatusString(
  pack: { status?: Record<string, string> },
  keySeg: string
): string | undefined {
  const s = pack.status?.[keySeg];
  return typeof s === "string" && s.trim() ? s : undefined;
}

/** Normalize for matching user-typed sheet cells across EN / pt-BR / ES (accents, spacing). */
export function normalizeSheetLocaleToken(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/** All strings (EN/PT/ES UI labels + API English) that should map to this canonical status for the given category. */
function labelsForCanonical(canonical: string, mediaType: MediaType): string[] {
  const out = new Set<string>();
  out.add(normalizeSheetLocaleToken(canonical));

  const keySeg = STATUS_I18N_KEYS[canonical];
  if (!keySeg) return [...out];

  for (const pack of [en, ptBR, es] as const) {
    const primary = getLocaleStatusString(pack, keySeg);
    if (primary) out.add(normalizeSheetLocaleToken(primary));
    if (canonical === "completed" && VIDEO_MEDIA_TYPES.includes(mediaType)) {
      const alt = getLocaleStatusString(pack, "completedForVideo");
      if (alt) out.add(normalizeSheetLocaleToken(alt));
    }
  }
  return [...out];
}

function buildLookup(mediaType: MediaType): Map<string, string> {
  const map = new Map<string, string>();
  for (const canonical of LOG_STATUS_OPTIONS[mediaType]) {
    for (const label of labelsForCanonical(canonical, mediaType)) {
      if (!label) continue;
      if (!map.has(label)) map.set(label, canonical);
    }
  }
  return map;
}

const lookupCache: Partial<Record<MediaType, Map<string, string>>> = {};

/**
 * Map a spreadsheet status cell to the API canonical value (English).
 * Accepts English API values and localized labels from en / pt-BR / es (same as in the app UI).
 */
export function resolveStatusFromSheet(
  raw: string | null | undefined,
  mediaType: MediaType,
  defaultStatus: string
): string {
  const trimmed = raw?.trim();
  if (!trimmed) return defaultStatus;
  if (!lookupCache[mediaType]) lookupCache[mediaType] = buildLookup(mediaType);
  const key = normalizeSheetLocaleToken(trimmed);
  return lookupCache[mediaType]!.get(key) ?? defaultStatus;
}
