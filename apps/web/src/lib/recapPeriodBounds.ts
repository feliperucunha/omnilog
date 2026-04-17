export type RecapPeriod = "week" | "month" | "year";

function offsetMs(tzOffsetMinutes: number): number {
  return Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes * 60 * 1000 : 0;
}

/**
 * Calendar windows in the user's offset (same convention as Statistics: `-getTimezoneOffset()`).
 * Week = previous ISO Monday–Sunday. Month = previous calendar month. Year = previous calendar year.
 */
export function recapBoundsForPeriod(period: RecapPeriod, tzOffsetMinutes: number): { from: Date; to: Date } {
  const om = offsetMs(tzOffsetMinutes);
  const now = new Date();
  const shifted = new Date(now.getTime() + om);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  const d = shifted.getUTCDate();

  if (period === "week") {
    const todayMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - om);
    const shiftedNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0) - om);
    const wd = shiftedNoon.getUTCDay();
    const daysFromMonday = wd === 0 ? 6 : wd - 1;
    const thisMonday = new Date(todayMidnight.getTime() - daysFromMonday * 86400000);
    const from = new Date(thisMonday.getTime() - 7 * 86400000);
    const to = new Date(thisMonday.getTime() - 1);
    return { from, to };
  }

  if (period === "month") {
    const from = new Date(Date.UTC(y, m - 2, 1, 0, 0, 0, 0) - om);
    const to = new Date(Date.UTC(y, m - 1, 0, 23, 59, 59, 999) - om);
    return { from, to };
  }

  const from = new Date(Date.UTC(y - 1, 0, 1, 0, 0, 0, 0) - om);
  const to = new Date(Date.UTC(y - 1, 11, 31, 23, 59, 59, 999) - om);
  return { from, to };
}

function intlLocale(locale: string): string {
  if (locale === "pt-BR") return "pt-BR";
  return locale;
}

/** Title-style month: first grapheme uppercased, rest unchanged from `Intl`. */
function capitalizeMonthLabel(raw: string, loc: string): string {
  const t = raw.trim();
  if (t.length === 0) return raw;
  return t.charAt(0).toLocaleUpperCase(loc) + t.slice(1);
}

export function buildRecapTitle(params: {
  period: RecapPeriod;
  categoryLabel: string;
  locale: string;
  tzOffsetMinutes: number;
  /** Localized “last week” (or equivalent); used instead of a date range for the week recap title. */
  weekLabel: string;
}): string {
  const { from } = recapBoundsForPeriod(params.period, params.tzOffsetMinutes);
  const loc = intlLocale(params.locale);
  const { categoryLabel } = params;

  if (params.period === "week") {
    return `${categoryLabel} — ${params.weekLabel}`;
  }

  if (params.period === "month") {
    const mf = new Intl.DateTimeFormat(loc, { month: "long" });
    const monthLabel = capitalizeMonthLabel(mf.format(from), loc);
    return `${categoryLabel} — ${monthLabel}`;
  }

  const shiftedFrom = new Date(from.getTime() + offsetMs(params.tzOffsetMinutes));
  const yearLabel = String(shiftedFrom.getUTCFullYear());
  return `${categoryLabel} — ${yearLabel}`;
}
