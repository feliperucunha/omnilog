import {
  isMarketSortValue,
  type MarketListing,
  type MarketListingsResponse,
  type MarketSortValue,
} from "@geeklogs/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { marketSellerSelect, serializeMarketListing } from "./marketListing.js";

export const MARKET_LISTINGS_PAGE_SIZE = 24;

const sellerSelect = marketSellerSelect;

type EffectiveMarketSort = Exclude<MarketSortValue, "relevance">;

type CursorRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  priceMinor: number;
  priceCurrency: string;
  previousPriceMinor: number | null;
};

type ListedCursorPayload = { v: 1; sort: "listed_desc" | "listed_asc"; at: string; id: string };
type UpdatedCursorPayload = { v: 1; sort: "updated_desc"; at: string; id: string };
type TitleCursorPayload = { v: 1; sort: "title_asc" | "title_desc"; title: string; id: string };
type PriceCursorPayload = {
  v: 1;
  sort: "price_asc" | "price_desc";
  priceMinor: number;
  priceCurrency: string;
  id: string;
};
type DealsCursorPayload = {
  v: 1;
  sort: "deals_desc";
  previousPriceMinor: number | null;
  priceMinor: number;
  id: string;
};
type ListingCursorPayload =
  | ListedCursorPayload
  | UpdatedCursorPayload
  | TitleCursorPayload
  | PriceCursorPayload
  | DealsCursorPayload;

function effectiveMarketSort(sort: MarketSortValue): EffectiveMarketSort {
  return sort === "relevance" ? "listed_desc" : sort;
}

function encodeListingCursor(sort: EffectiveMarketSort, row: CursorRow): string {
  let payload: ListingCursorPayload;
  switch (sort) {
    case "title_asc":
    case "title_desc":
      payload = { v: 1, sort, title: row.title, id: row.id };
      break;
    case "price_asc":
    case "price_desc":
      payload = {
        v: 1,
        sort,
        priceMinor: row.priceMinor,
        priceCurrency: row.priceCurrency,
        id: row.id,
      };
      break;
    case "deals_desc":
      payload = {
        v: 1,
        sort: "deals_desc",
        previousPriceMinor: row.previousPriceMinor,
        priceMinor: row.priceMinor,
        id: row.id,
      };
      break;
    case "updated_desc":
      payload = { v: 1, sort: "updated_desc", at: row.updatedAt.toISOString(), id: row.id };
      break;
    case "listed_asc":
      payload = { v: 1, sort: "listed_asc", at: row.createdAt.toISOString(), id: row.id };
      break;
    default:
      payload = { v: 1, sort: "listed_desc", at: row.createdAt.toISOString(), id: row.id };
  }
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeListingCursor(
  raw: string | undefined,
  sort: EffectiveMarketSort
): ListingCursorPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as ListingCursorPayload;
    if (parsed?.v !== 1) return null;
    if (parsed.sort === sort) return parsed;
    if (
      sort === "listed_desc" &&
      (parsed.sort === "listed_desc" || parsed.sort === "updated_desc") &&
      "at" in parsed
    ) {
      return { v: 1, sort: "listed_desc", at: parsed.at, id: parsed.id };
    }
  } catch {
    // legacy cursor: plain ISO date
  }
  if (sort === "listed_desc" || sort === "updated_desc") {
    const cursorDate = new Date(raw);
    if (!Number.isNaN(cursorDate.getTime())) {
      return sort === "updated_desc"
        ? { v: 1, sort: "updated_desc", at: cursorDate.toISOString(), id: "" }
        : { v: 1, sort: "listed_desc", at: cursorDate.toISOString(), id: "" };
    }
  }
  return null;
}

function listingOrderBy(sort: EffectiveMarketSort): Prisma.MarketListingOrderByWithRelationInput[] {
  switch (sort) {
    case "listed_asc":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "updated_desc":
      return [{ updatedAt: "desc" }, { id: "desc" }];
    case "title_asc":
      return [{ title: "asc" }, { id: "asc" }];
    case "title_desc":
      return [{ title: "desc" }, { id: "desc" }];
    case "price_asc":
      return [{ priceMinor: "asc" }, { priceCurrency: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ priceMinor: "desc" }, { priceCurrency: "desc" }, { id: "desc" }];
    case "deals_desc":
      return [
        { previousPriceMinor: { sort: "desc", nulls: "last" } },
        { priceMinor: "asc" },
        { id: "asc" },
      ];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

function listingCursorWhere(
  sort: EffectiveMarketSort,
  cursor: ListingCursorPayload
): Prisma.MarketListingWhereInput {
  if (sort === "listed_asc" && cursor.sort === "listed_asc") {
    const at = new Date(cursor.at);
    return {
      OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: cursor.id } }],
    };
  }
  if (sort === "updated_desc" && cursor.sort === "updated_desc") {
    const at = new Date(cursor.at);
    if (!cursor.id) return { updatedAt: { lt: at } };
    return {
      OR: [{ updatedAt: { lt: at } }, { updatedAt: at, id: { lt: cursor.id } }],
    };
  }
  if (sort === "title_asc" && cursor.sort === "title_asc") {
    return {
      OR: [
        { title: { gt: cursor.title } },
        { title: cursor.title, id: { gt: cursor.id } },
      ],
    };
  }
  if (sort === "title_desc" && cursor.sort === "title_desc") {
    return {
      OR: [
        { title: { lt: cursor.title } },
        { title: cursor.title, id: { lt: cursor.id } },
      ],
    };
  }
  if (sort === "price_asc" && cursor.sort === "price_asc") {
    return {
      OR: [
        { priceMinor: { gt: cursor.priceMinor } },
        {
          priceMinor: cursor.priceMinor,
          priceCurrency: { gt: cursor.priceCurrency },
        },
        {
          priceMinor: cursor.priceMinor,
          priceCurrency: cursor.priceCurrency,
          id: { gt: cursor.id },
        },
      ],
    };
  }
  if (sort === "price_desc" && cursor.sort === "price_desc") {
    return {
      OR: [
        { priceMinor: { lt: cursor.priceMinor } },
        {
          priceMinor: cursor.priceMinor,
          priceCurrency: { lt: cursor.priceCurrency },
        },
        {
          priceMinor: cursor.priceMinor,
          priceCurrency: cursor.priceCurrency,
          id: { lt: cursor.id },
        },
      ],
    };
  }
  if (sort === "deals_desc" && cursor.sort === "deals_desc") {
    if (cursor.previousPriceMinor == null) {
      return {
        previousPriceMinor: null,
        OR: [
          { priceMinor: { gt: cursor.priceMinor } },
          { priceMinor: cursor.priceMinor, id: { gt: cursor.id } },
        ],
      };
    }
    return {
      OR: [
        { previousPriceMinor: { lt: cursor.previousPriceMinor } },
        {
          previousPriceMinor: cursor.previousPriceMinor,
          priceMinor: { gt: cursor.priceMinor },
        },
        {
          previousPriceMinor: cursor.previousPriceMinor,
          priceMinor: cursor.priceMinor,
          id: { gt: cursor.id },
        },
        { previousPriceMinor: null },
      ],
    };
  }
  if (sort === "listed_desc" && cursor.sort === "listed_desc") {
    const at = new Date(cursor.at);
    if (!cursor.id) return { createdAt: { lt: at } };
    return {
      OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: cursor.id } }],
    };
  }
  return {};
}

export function resolveMarketSort(sortRaw: string | undefined): MarketSortValue {
  return sortRaw && isMarketSortValue(sortRaw) ? sortRaw : "listed_desc";
}

export async function fetchMarketListingsPage(args: {
  filters: Prisma.MarketListingWhereInput;
  sort: MarketSortValue;
  cursor?: string;
  limit: number;
}): Promise<MarketListingsResponse> {
  const order = effectiveMarketSort(args.sort);
  const decodedCursor = decodeListingCursor(args.cursor, order);
  const where: Prisma.MarketListingWhereInput = decodedCursor
    ? { AND: [args.filters, listingCursorWhere(order, decodedCursor)] }
    : args.filters;

  const rows = await prisma.marketListing.findMany({
    where,
    include: { user: { select: sellerSelect } },
    orderBy: listingOrderBy(order),
    take: args.limit + 1,
  });

  const hasMore = rows.length > args.limit;
  const page = hasMore ? rows.slice(0, args.limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeListingCursor(order, last) : null;

  return {
    data: page.map((row) => serializeMarketListing(row) as MarketListing),
    nextCursor,
  };
}

export function buildMarketListingSearchFilter(q: string | undefined): Prisma.MarketListingWhereInput | null {
  if (!q?.trim()) return null;
  const term = q.trim();
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ],
  };
}
