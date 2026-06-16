import { Router } from "express";
import { z } from "zod";
import {
  MARKET_MEDIA_TYPES,
  isMarketMediaType,
  type MarketListing,
} from "@geeklogs/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { marketSellerSelect, serializeMarketListing } from "../lib/marketListing.js";
import {
  buildMarketListingSearchFilter,
  fetchMarketListingsPage,
  MARKET_LISTINGS_PAGE_SIZE,
  resolveMarketSort,
} from "../lib/marketListingPagination.js";
import { sanitizeText } from "../lib/sanitize.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const marketRouter = Router();

const PAGE_SIZE = MARKET_LISTINGS_PAGE_SIZE;

const sellerSelect = marketSellerSelect;

function serializeListing(row: Parameters<typeof serializeMarketListing>[0]): MarketListing {
  return serializeMarketListing(row);
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
  const sort = resolveMarketSort(parsed.data.sort);

  const filters: Prisma.MarketListingWhereInput = { active: true };

  if (mediaType) filters.mediaType = mediaType;
  const countryCode = country?.trim().toUpperCase().slice(0, 2);
  if (countryCode && countryCode.length === 2) {
    filters.country = countryCode;
  } else if (city && city.trim()) {
    filters.city = city.trim();
  }
  const searchFilter = buildMarketListingSearchFilter(q);
  if (searchFilter) {
    Object.assign(filters, searchFilter);
  }

  const body = await fetchMarketListingsPage({ filters, sort, cursor, limit });
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

const myListQuerySchema = z.object({
  mediaType: z.enum(MARKET_MEDIA_TYPES).optional(),
  q: z.string().max(128).optional(),
  sort: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
});

marketRouter.get("/my/listings", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = myListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { mediaType, q, cursor } = parsed.data;
  const limit = parsed.data.limit ?? PAGE_SIZE;
  const sort = resolveMarketSort(parsed.data.sort);

  const filters: Prisma.MarketListingWhereInput = {
    active: true,
    userId: req.user.userId,
  };
  if (mediaType) filters.mediaType = mediaType;
  const searchFilter = buildMarketListingSearchFilter(q);
  if (searchFilter) {
    Object.assign(filters, searchFilter);
  }

  const body = await fetchMarketListingsPage({ filters, sort, cursor, limit });
  res.json(body);
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
