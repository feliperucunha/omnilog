/** Decimal places for minor units (ISO 4217–style). */
const DECIMALS: Record<string, number> = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
};

const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  BRL: "pt-BR",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  CAD: "en-CA",
  AUD: "en-AU",
  CHF: "de-CH",
  MXN: "es-MX",
  ARS: "es-AR",
  CLP: "es-CL",
  COP: "es-CO",
  PLN: "pl-PL",
  SEK: "sv-SE",
  NOK: "nb-NO",
  DKK: "da-DK",
  CNY: "zh-CN",
  INR: "en-IN",
  KRW: "ko-KR",
};

export function currencyMinorDecimals(currency: string): number {
  return DECIMALS[currency.toUpperCase()] ?? 2;
}

export function localeForCurrency(currency: string): string {
  return CURRENCY_LOCALES[currency.toUpperCase()] ?? "en-US";
}

export function currencyDecimalSeparator(currency: string): string {
  const parts = new Intl.NumberFormat(localeForCurrency(currency)).formatToParts(1.1);
  return parts.find((p) => p.type === "decimal")?.value ?? ".";
}

export function currencyGroupSeparator(currency: string): string {
  const parts = new Intl.NumberFormat(localeForCurrency(currency)).formatToParts(1000.1);
  return parts.find((p) => p.type === "group")?.value ?? ",";
}

export function minorToAmountString(minor: number | null | undefined, currency: string): string {
  if (minor == null || minor < 0) return "";
  const d = currencyMinorDecimals(currency);
  const divisor = 10 ** d;
  const n = minor / divisor;
  const locale = localeForCurrency(currency);
  if (d === 0) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(n));
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n);
}

/** Parse user text to minor units; returns null if empty/invalid. */
export function parseAmountToMinor(raw: string, currency: string): number | null {
  const t = raw.trim();
  if (t === "") return null;

  const d = currencyMinorDecimals(currency);
  if (d === 0) {
    const digits = t.replace(/\D/g, "");
    if (digits === "") return null;
    const majorNum = parseInt(digits, 10);
    if (!Number.isFinite(majorNum) || majorNum > 1e12) return null;
    return majorNum;
  }

  const groupSep = currencyGroupSeparator(currency);
  const decSep = currencyDecimalSeparator(currency);
  const withoutGroups = t.split(groupSep).join("");
  const decIndex = withoutGroups.lastIndexOf(decSep);

  let intPart: string;
  let fracRaw: string;
  if (decIndex === -1) {
    intPart = withoutGroups.replace(/\D/g, "");
    fracRaw = "";
  } else {
    intPart = withoutGroups.slice(0, decIndex).replace(/\D/g, "");
    fracRaw = withoutGroups.slice(decIndex + 1).replace(/\D/g, "");
  }

  if (intPart === "" && fracRaw === "") return null;
  const majorNum = parseInt(intPart === "" ? "0" : intPart, 10);
  const fracPadded = (fracRaw + "0".repeat(d)).slice(0, d);
  const fracNum = parseInt(fracPadded || "0", 10);
  if (!Number.isFinite(majorNum) || majorNum > 1e12) return null;
  if (!Number.isFinite(fracNum)) return null;
  return majorNum * 10 ** d + fracNum;
}
