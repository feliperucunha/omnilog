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

export function currencyMinorDecimals(currency: string): number {
  return DECIMALS[currency.toUpperCase()] ?? 2;
}

export function minorToAmountString(minor: number | null | undefined, currency: string): string {
  if (minor == null || minor < 0) return "";
  const d = currencyMinorDecimals(currency);
  const divisor = 10 ** d;
  const n = minor / divisor;
  if (d === 0) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n);
}

function formatIntegerWithGrouping(intDigits: string): string {
  if (intDigits === "") return "";
  const n = BigInt(intDigits);
  return n.toLocaleString(undefined);
}

/**
 * Formats the amount field while typing: grouping separators on the integer part,
 * at most `d` fractional digits, preserves a trailing "." while entering decimals.
 */
export function formatPartialMoneyInput(raw: string, currency: string): string {
  const d = currencyMinorDecimals(currency);
  const stripped = raw.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (stripped === "") return "";

  const firstDot = stripped.indexOf(".");
  if (d === 0) {
    const digitsOnly = stripped.replace(/\./g, "");
    if (digitsOnly === "") return "";
    return formatIntegerWithGrouping(digitsOnly);
  }

  let intRaw: string;
  let fracRaw: string;
  let hasTrailingDot: boolean;
  if (firstDot === -1) {
    intRaw = stripped;
    fracRaw = "";
    hasTrailingDot = false;
  } else {
    intRaw = stripped.slice(0, firstDot);
    fracRaw = stripped.slice(firstDot + 1).replace(/\./g, "");
    hasTrailingDot = fracRaw === "" && stripped.endsWith(".");
  }
  fracRaw = fracRaw.slice(0, d);

  const intDigits = intRaw.replace(/\D/g, "");
  const intFormatted = intDigits === "" ? "" : formatIntegerWithGrouping(intDigits);

  if (firstDot === -1) return intFormatted;
  if (hasTrailingDot) return intFormatted === "" ? "." : `${intFormatted}.`;
  return `${intFormatted}.${fracRaw}`;
}

/** Parse user text to minor units; returns null if empty/invalid. */
export function parseAmountToMinor(raw: string, currency: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  let normalized = t.replace(/,/g, "").replace(/[^\d.]/g, "");
  const firstDot = normalized.indexOf(".");
  if (firstDot !== -1) {
    normalized =
      normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, "");
  }
  const match = /^(\d*)(?:\.(\d*))?$/.exec(normalized);
  if (!match) return null;
  const intPart = match[1] === "" ? "0" : match[1]!;
  const fracRaw = match[2] ?? "";
  const d = currencyMinorDecimals(currency);
  const fracPadded = (fracRaw + "0".repeat(d)).slice(0, d);
  const majorNum = parseInt(intPart, 10);
  const fracNum = d === 0 ? 0 : parseInt(fracPadded || "0", 10);
  if (!Number.isFinite(majorNum) || majorNum > 1e12) return null;
  return majorNum * 10 ** d + fracNum;
}
