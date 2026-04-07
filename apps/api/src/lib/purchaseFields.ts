import type { MediaType } from "@geeklogs/shared";
import { SPEND_TRACKED_MEDIA_TYPES } from "@geeklogs/shared";
import type { Prisma } from "@prisma/client";

const SPEND_SET = new Set<string>(SPEND_TRACKED_MEDIA_TYPES);

export function isSpendTrackedMediaType(m: MediaType): boolean {
  return SPEND_SET.has(m);
}

const ISO4217 = /^[A-Z]{3}$/;

export function normalizePurchaseFields(
  mediaType: MediaType,
  purchaseAmountMinor: number | null | undefined,
  purchaseCurrency: string | null | undefined
):
  | { ok: true; purchaseAmountMinor: number | null; purchaseCurrency: string | null }
  | { ok: false; error: string } {
  if (!isSpendTrackedMediaType(mediaType)) {
    if (purchaseAmountMinor != null || (purchaseCurrency != null && purchaseCurrency !== "")) {
      return {
        ok: false,
        error: "Purchase amount is only supported for games, board games, books, manga, and comics.",
      };
    }
    return { ok: true, purchaseAmountMinor: null, purchaseCurrency: null };
  }
  const amt = purchaseAmountMinor ?? null;
  const curRaw = purchaseCurrency?.trim() ?? "";
  const cur = curRaw === "" ? null : curRaw.toUpperCase();
  if (amt == null && (cur == null || cur === "")) {
    return { ok: true, purchaseAmountMinor: null, purchaseCurrency: null };
  }
  if (amt == null || cur == null || cur === "") {
    return { ok: false, error: "Enter both amount and currency, or leave purchase empty." };
  }
  if (amt < 0 || amt > 999_999_999_999) {
    return { ok: false, error: "Invalid purchase amount." };
  }
  if (!ISO4217.test(cur)) {
    return { ok: false, error: "Invalid currency (use a 3-letter ISO 4217 code, e.g. USD)." };
  }
  return { ok: true, purchaseAmountMinor: amt, purchaseCurrency: cur };
}

/** Same rules as purchase; used for sale proceeds when log.sold is true. */
export function normalizeSaleFields(
  mediaType: MediaType,
  saleAmountMinor: number | null | undefined,
  saleCurrency: string | null | undefined
):
  | { ok: true; saleAmountMinor: number | null; saleCurrency: string | null }
  | { ok: false; error: string } {
  if (!isSpendTrackedMediaType(mediaType)) {
    if (saleAmountMinor != null || (saleCurrency != null && saleCurrency !== "")) {
      return {
        ok: false,
        error: "Sale amount is only supported for games, board games, books, manga, and comics.",
      };
    }
    return { ok: true, saleAmountMinor: null, saleCurrency: null };
  }
  const amt = saleAmountMinor ?? null;
  const curRaw = saleCurrency?.trim() ?? "";
  const cur = curRaw === "" ? null : curRaw.toUpperCase();
  if (amt == null && (cur == null || cur === "")) {
    return { ok: true, saleAmountMinor: null, saleCurrency: null };
  }
  if (amt == null || cur == null || cur === "") {
    return { ok: false, error: "Enter both amount and currency for sale, or leave sale empty." };
  }
  if (amt < 0 || amt > 999_999_999_999) {
    return { ok: false, error: "Invalid sale amount." };
  }
  if (!ISO4217.test(cur)) {
    return { ok: false, error: "Invalid currency (use a 3-letter ISO 4217 code, e.g. USD)." };
  }
  return { ok: true, saleAmountMinor: amt, saleCurrency: cur };
}

export type PurchasePeriod = "month" | "year" | "all";

/**
 * Parse YYYY-MM-DD and return UTC bounds for that calendar day in the user's local timezone
 * (same math as GET /logs/by-date). Used for purchase-day filtering on the log list.
 */
export function localDayBoundsFromDateString(
  dateParam: string,
  tzOffsetMinutes: number
): { gte: Date; lte: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam.trim());
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const offsetMs = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes * 60 * 1000 : 0;
  const gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMs);
  const lte = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetMs);
  return { gte, lte };
}

/** Snapshot of stored purchase + sale money fields (for detecting changes). */
export type SpendMonetarySnapshot = {
  purchaseAmountMinor: number | null;
  purchaseCurrency: string | null;
  saleAmountMinor: number | null;
  saleCurrency: string | null;
};

export function spendMonetarySnapshotFromLog(log: {
  purchaseAmountMinor: number | null;
  purchaseCurrency: string | null;
  saleAmountMinor: number | null;
  saleCurrency: string | null;
}): SpendMonetarySnapshot {
  return {
    purchaseAmountMinor: log.purchaseAmountMinor ?? null,
    purchaseCurrency: log.purchaseCurrency != null ? log.purchaseCurrency.toUpperCase() : null,
    saleAmountMinor: log.saleAmountMinor ?? null,
    saleCurrency: log.saleCurrency != null ? log.saleCurrency.toUpperCase() : null,
  };
}

export function spendMonetarySnapshotsEqual(a: SpendMonetarySnapshot, b: SpendMonetarySnapshot): boolean {
  return (
    a.purchaseAmountMinor === b.purchaseAmountMinor &&
    a.purchaseCurrency === b.purchaseCurrency &&
    a.saleAmountMinor === b.saleAmountMinor &&
    a.saleCurrency === b.saleCurrency
  );
}

export function spendMonetaryHasAny(s: SpendMonetarySnapshot): boolean {
  const hasPurchase =
    s.purchaseAmountMinor != null && s.purchaseCurrency != null && s.purchaseCurrency !== "";
  const hasSale = s.saleAmountMinor != null && s.saleCurrency != null && s.saleCurrency !== "";
  return hasPurchase || hasSale;
}

/**
 * After computing next purchase/sale snapshot: if unchanged leave column as-is (`undefined`);
 * if cleared return `null`; if still has amounts return `now`.
 */
export function spendFieldsAtAfterSnapshotChange(
  prev: SpendMonetarySnapshot,
  next: SpendMonetarySnapshot,
  now: Date
): Date | null | undefined {
  if (spendMonetarySnapshotsEqual(prev, next)) return undefined;
  if (!spendMonetaryHasAny(next)) return null;
  return now;
}

/**
 * Spend stats / purchased list: attribute rows to a calendar window by when money fields were set,
 * with legacy fallback to `createdAt` when `spendFieldsAt` is null (pre-migration rows).
 */
export function logSpendStatsDateWhere(range: { gte: Date; lte: Date } | undefined): Prisma.LogWhereInput {
  if (!range) return {};
  return {
    OR: [
      { spendFieldsAt: { gte: range.gte, lte: range.lte } },
      {
        AND: [{ spendFieldsAt: null }, { createdAt: { gte: range.gte, lte: range.lte } }],
      },
    ],
  };
}

/** Same attribution as logSpendStatsDateWhere, but end is exclusive (`lt`), e.g. monthly digest windows. */
export function logSpendStatsDateWhereHalfOpen(
  range: { gte: Date; lt: Date } | undefined
): Prisma.LogWhereInput {
  if (!range) return {};
  return {
    OR: [
      { spendFieldsAt: { gte: range.gte, lt: range.lt } },
      {
        AND: [{ spendFieldsAt: null }, { createdAt: { gte: range.gte, lt: range.lt } }],
      },
    ],
  };
}

/** Filter on Log.createdAt for spend stats; `all` = no date bounds. */
export function purchaseLogCreatedAtRange(
  period: PurchasePeriod,
  tzOffsetMinutes: number
): { gte: Date; lte: Date } | undefined {
  if (period === "all") return undefined;
  const offsetMs = tzOffsetMinutes * 60 * 1000;
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  if (period === "month") {
    const gte = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0) - offsetMs);
    const lte = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999) - offsetMs);
    return { gte, lte };
  }
  const gte = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0) - offsetMs);
  const lte = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999) - offsetMs);
  return { gte, lte };
}
