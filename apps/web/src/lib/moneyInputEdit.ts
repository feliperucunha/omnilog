import { currencyMinorDecimals } from "@/lib/moneyInput";

const MAX_MAJOR = 1e12;

function factor(decimals: number): number {
  return 10 ** decimals;
}

/** Append a digit to the integer (major) part; e.g. null + 1 → 1,00 in BRL. */
export function pushMajorDigit(minor: number | null, digit: number, decimals: number): number {
  if (decimals === 0) {
    const next = (minor ?? 0) * 10 + digit;
    return next > MAX_MAJOR ? (minor ?? 0) : next;
  }
  const f = factor(decimals);
  const major = Math.floor((minor ?? 0) / f);
  const frac = (minor ?? 0) % f;
  const nextMajor = major * 10 + digit;
  if (nextMajor > MAX_MAJOR) return minor ?? 0;
  return nextMajor * f + frac;
}

/** Remove the last integer digit; e.g. 12,00 → 1,00 → empty. */
export function popMajorDigit(minor: number | null, decimals: number): number | null {
  if (minor == null || minor === 0) return null;
  if (decimals === 0) {
    const next = Math.floor(minor / 10);
    return next === 0 ? null : next;
  }
  const f = factor(decimals);
  const major = Math.floor(minor / f);
  const frac = minor % f;
  const nextMajor = Math.floor(major / 10);
  if (nextMajor === 0 && frac === 0) return null;
  return nextMajor * f + frac;
}

/** Append a digit to the fractional part after the decimal separator was entered. */
export function pushFractionDigit(minor: number, digit: number, decimals: number): number {
  if (decimals === 0) return minor;
  const f = factor(decimals);
  const major = Math.floor(minor / f);
  const frac = minor % f;
  const nextFrac = (frac * 10 + digit) % f;
  return major * f + nextFrac;
}

/** Remove the last fractional digit; falls back to major pop when fraction is zero. */
export function popFractionDigit(minor: number | null, decimals: number): number | null {
  if (minor == null || minor === 0) return null;
  if (decimals === 0) return popMajorDigit(minor, 0);
  const f = factor(decimals);
  const major = Math.floor(minor / f);
  let frac = minor % f;
  if (frac === 0) return popMajorDigit(minor, decimals);
  frac = Math.floor(frac / 10);
  if (major === 0 && frac === 0) return null;
  return major * f + frac;
}

export function fractionPart(minor: number | null, currency: string): number {
  const d = currencyMinorDecimals(currency);
  if (minor == null || d === 0) return 0;
  return minor % factor(d);
}
