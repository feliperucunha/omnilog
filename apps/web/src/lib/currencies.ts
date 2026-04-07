/** Common ISO 4217 codes for the purchase + stats currency picker (label = code + name). */
export const COMMON_CURRENCIES: readonly { code: string; labelKey: string }[] = [
  { code: "USD", labelKey: "money.currencyUSD" },
  { code: "EUR", labelKey: "money.currencyEUR" },
  { code: "GBP", labelKey: "money.currencyGBP" },
  { code: "BRL", labelKey: "money.currencyBRL" },
  { code: "JPY", labelKey: "money.currencyJPY" },
  { code: "CAD", labelKey: "money.currencyCAD" },
  { code: "AUD", labelKey: "money.currencyAUD" },
  { code: "CHF", labelKey: "money.currencyCHF" },
  { code: "MXN", labelKey: "money.currencyMXN" },
  { code: "ARS", labelKey: "money.currencyARS" },
  { code: "CLP", labelKey: "money.currencyCLP" },
  { code: "COP", labelKey: "money.currencyCOP" },
  { code: "PLN", labelKey: "money.currencyPLN" },
  { code: "SEK", labelKey: "money.currencySEK" },
  { code: "NOK", labelKey: "money.currencyNOK" },
  { code: "DKK", labelKey: "money.currencyDKK" },
  { code: "CNY", labelKey: "money.currencyCNY" },
  { code: "INR", labelKey: "money.currencyINR" },
  { code: "KRW", labelKey: "money.currencyKRW" },
] as const;

export const DEFAULT_PURCHASE_CURRENCY = "USD";

/** Normalize API/user currency to uppercase ISO code, or null if empty. */
export function normalizeCurrencyCode(code: string | null | undefined): string | null {
  if (code == null) return null;
  const s = String(code).trim();
  if (s === "") return null;
  return s.toUpperCase();
}
