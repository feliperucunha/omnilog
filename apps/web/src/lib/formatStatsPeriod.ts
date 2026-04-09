import type { Locale } from "@/contexts/LocaleContext";

function intlLocaleTag(locale: Locale): string {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "es") return "es";
  return "en";
}

/**
 * Human-readable label for stats API period keys (`YYYY-MM` or `YYYY`), UTC-aligned with the API.
 */
export function formatStatsTimeAxisLabel(
  period: string,
  granularity: "month" | "year",
  locale: Locale
): string {
  const tag = intlLocaleTag(locale);
  if (granularity === "year") {
    if (/^\d{4}$/.test(period)) {
      return new Intl.DateTimeFormat(tag, { year: "numeric", timeZone: "UTC" }).format(
        new Date(Date.UTC(Number(period), 0, 1))
      );
    }
    return period;
  }
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const y = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(y) || month < 1 || month > 12) return period;
  return new Intl.DateTimeFormat(tag, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, month - 1, 1)));
}
