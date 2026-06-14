import { Router } from "express";
import { z } from "zod";
import {
  MARKET_MEDIA_TYPES,
  isMarketMediaType,
  isMarketSortValue,
  type MarketListing,
  type MarketListingsResponse,
  type MarketSortValue,
} from "@geeklogs/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { marketSellerSelect, serializeMarketListing } from "../lib/marketListing.js";
import { sanitizeText } from "../lib/sanitize.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const marketRouter = Router();

const PAGE_SIZE = 24;

const sellerSelect = marketSellerSelect;

function serializeListing(row: Parameters<typeof serializeMarketListing>[0]): MarketListing {
  return serializeMarketListing(row);
}

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

const listQuerySchema = z.object({
  mediaType: z.enum(MARKET_MEDIA_TYPES).optional(),
  q: z.string().max(128).optional(),
  city: z.string().max(128).optional(),
  country: z.string().max(2).optional(),
  sort: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
});

marketRouter.get("/listings", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { mediaType, q, city, country, cursor } = parsed.data;
  const limit = parsed.data.limit ?? PAGE_SIZE;
  const sort: MarketSortValue =
    parsed.data.sort && isMarketSortValue(parsed.data.sort) ? parsed.data.sort : "listed_desc";
  const order = effectiveMarketSort(sort);

  const filters: Prisma.MarketListingWhereInput = { active: true };

  if (mediaType) filters.mediaType = mediaType;
  const countryCode = country?.trim().toUpperCase().slice(0, 2);
  if (countryCode && countryCode.length === 2) {
    filters.country = countryCode;
  } else if (city && city.trim()) {
    filters.city = city.trim();
  }
  if (q && q.trim()) {
    const term = q.trim();
    filters.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  const decodedCursor = decodeListingCursor(cursor, order);
  const where: Prisma.MarketListingWhereInput = decodedCursor
    ? { AND: [filters, listingCursorWhere(order, decodedCursor)] }
    : filters;

  const rows = await prisma.marketListing.findMany({
    where,
    include: { user: { select: sellerSelect } },
    orderBy: listingOrderBy(order),
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeListingCursor(order, last) : null;

  const body: MarketListingsResponse = {
    data: page.map(serializeListing),
    nextCursor,
  };
  res.json(body);
});

marketRouter.get("/listings/:id", async (req, res) => {
  const row = await prisma.marketListing.findFirst({
    where: { id: req.params.id, active: true },
    include: { user: { select: sellerSelect } },
  });
  if (!row) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  res.json(serializeListing(row));
});

marketRouter.get("/locations", async (_req, res) => {
  const [cityRows, countryRows] = await Promise.all([
    prisma.marketListing.findMany({
      where: { active: true },
      select: { city: true, cityLabel: true },
      distinct: ["city"],
      orderBy: { cityLabel: "asc" },
      take: 200,
    }),
    prisma.marketListing.findMany({
      where: { active: true, country: { not: null } },
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
      take: 100,
    }),
  ]);
  res.json({
    data: {
      cities: cityRows.map((r) => ({ city: r.city, label: r.cityLabel })),
      countries: countryRows
        .map((r) => r.country)
        .filter((c): c is string => Boolean(c))
        .map((country) => ({ country })),
    },
  });
});

marketRouter.use(authMiddleware);

marketRouter.get("/my/log-ids", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const rows = await prisma.marketListing.findMany({
    where: { userId: req.user.userId, active: true },
    select: { logId: true },
  });
  res.json({ data: rows.map((r) => r.logId) });
});

const createListingSchema = z.object({
  logId: z.string().min(1),
  priceMinor: z.number().int().min(1),
  priceCurrency: z.string().min(3).max(3),
  description: z.string().min(1).max(4000),
  acceptTrade: z.boolean(),
  localDelivery: z.boolean(),
  shipsByMail: z.boolean(),
  contactEmail: z.boolean(),
  contactWhatsapp: z.boolean(),
  phone: z.string().max(32).optional(),
});

marketRouter.get("/my/:logId", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const row = await prisma.marketListing.findFirst({
    where: { logId: req.params.logId, userId: req.user.userId, active: true },
    include: { user: { select: sellerSelect } },
  });
  if (!row) {
    res.json({ data: null });
    return;
  }
  res.json({ data: serializeListing(row) });
});

marketRouter.post("/listings", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  if (!data.contactEmail && !data.contactWhatsapp) {
    res.status(400).json({ error: "At least one contact method is required" });
    return;
  }

  const log = await prisma.log.findFirst({
    where: { id: data.logId, userId: req.user.userId },
  });
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  if (!isMarketMediaType(log.mediaType)) {
    res.status(400).json({ error: "This category cannot be listed on the market" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { city: true, cityLabel: true, country: true, phone: true },
  });
  if (!user?.city || !user.cityLabel) {
    res.status(400).json({ error: "Set your city in user settings before listing" });
    return;
  }

  const description = sanitizeText(data.description, 4000);
  if (!description) {
    res.status(400).json({ error: "Description is required" });
    return;
  }

  const priceCurrency = data.priceCurrency.trim().toUpperCase().slice(0, 3);
  const phoneUpdate =
    data.contactWhatsapp && data.phone?.trim()
      ? sanitizeText(data.phone.trim(), 32)
      : null;

  if (phoneUpdate) {
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { phone: phoneUpdate },
    });
  } else if (data.contactWhatsapp && !user.phone && !data.phone?.trim()) {
    res.status(400).json({ error: "Phone number required for WhatsApp contact" });
    return;
  }

  const existingListing = await prisma.marketListing.findUnique({
    where: { logId: log.id },
  });

  let previousPriceMinor: number | null = null;
  if (existingListing) {
    if (existingListing.priceCurrency === priceCurrency) {
      if (data.priceMinor < existingListing.priceMinor) {
        previousPriceMinor = existingListing.priceMinor;
      } else if (data.priceMinor > existingListing.priceMinor) {
        previousPriceMinor = null;
      } else {
        previousPriceMinor = existingListing.previousPriceMinor;
      }
    }
  }

  const listingData = {
    userId: req.user.userId,
    logId: log.id,
    mediaType: log.mediaType,
    externalId: log.externalId,
    title: log.title,
    image: log.image,
    priceMinor: data.priceMinor,
    priceCurrency,
    previousPriceMinor,
    description,
    acceptTrade: data.acceptTrade,
    localDelivery: data.localDelivery,
    shipsByMail: data.shipsByMail,
    contactEmail: data.contactEmail,
    contactWhatsapp: data.contactWhatsapp,
    city: user.city,
    cityLabel: user.cityLabel,
    country: user.country,
    active: true,
  };

  const row = await prisma.marketListing.upsert({
    where: { logId: log.id },
    create: listingData,
    update: listingData,
    include: { user: { select: sellerSelect } },
  });

  res.status(201).json({ data: serializeListing(row) });
});

marketRouter.delete("/listings/:id", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const existing = await prisma.marketListing.findFirst({
    where: { id: req.params.id, userId: req.user.userId },
  });
  if (!existing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  await prisma.marketListing.update({
    where: { id: existing.id },
    data: { active: false },
  });
  res.json({ ok: true });
});
