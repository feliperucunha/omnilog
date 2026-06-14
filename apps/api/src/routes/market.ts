import { Router } from "express";
import { z } from "zod";
import {
  MARKET_MEDIA_TYPES,
  isMarketMediaType,
  type MarketListing,
  type MarketListingsResponse,
} from "@geeklogs/shared";
import { prisma } from "../lib/prisma.js";
import { sanitizeText } from "../lib/sanitize.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const marketRouter = Router();

const PAGE_SIZE = 24;

const sellerSelect = {
  id: true,
  username: true,
  email: true,
  phone: true,
  cityLabel: true,
} as const;

function serializeListing(row: {
  id: string;
  userId: string;
  logId: string;
  mediaType: string;
  externalId: string;
  title: string;
  image: string | null;
  priceMinor: number;
  priceCurrency: string;
  previousPriceMinor: number | null;
  description: string;
  acceptTrade: boolean;
  localDelivery: boolean;
  shipsByMail: boolean;
  contactEmail: boolean;
  contactWhatsapp: boolean;
  city: string;
  cityLabel: string;
  country: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    username: string | null;
    email: string;
    phone: string | null;
    cityLabel: string | null;
  };
}): MarketListing {
  return {
    id: row.id,
    userId: row.userId,
    logId: row.logId,
    mediaType: row.mediaType as MarketListing["mediaType"],
    externalId: row.externalId,
    title: row.title,
    image: row.image,
    priceMinor: row.priceMinor,
    priceCurrency: row.priceCurrency,
    previousPriceMinor: row.previousPriceMinor,
    description: row.description,
    acceptTrade: row.acceptTrade,
    localDelivery: row.localDelivery,
    shipsByMail: row.shipsByMail,
    contactEmail: row.contactEmail,
    contactWhatsapp: row.contactWhatsapp,
    city: row.city,
    cityLabel: row.cityLabel,
    country: row.country,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    seller: {
      id: row.user.id,
      username: row.user.username,
      email: row.user.email,
      phone: row.user.phone,
      cityLabel: row.user.cityLabel,
    },
  };
}

const listQuerySchema = z.object({
  mediaType: z.enum(MARKET_MEDIA_TYPES).optional(),
  q: z.string().max(128).optional(),
  city: z.string().max(128).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
});

marketRouter.get("/listings", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { mediaType, q, city, cursor } = parsed.data;
  const limit = parsed.data.limit ?? PAGE_SIZE;

  const where: {
    active: boolean;
    mediaType?: string;
    city?: string;
    OR?: Array<{ title: { contains: string; mode: "insensitive" } } | { description: { contains: string; mode: "insensitive" } }>;
    createdAt?: { lt: Date };
  } = { active: true };

  if (mediaType) where.mediaType = mediaType;
  if (city && city.trim()) where.city = city.trim();
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      where.createdAt = { lt: cursorDate };
    }
  }

  const rows = await prisma.marketListing.findMany({
    where,
    include: { user: { select: sellerSelect } },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.createdAt.toISOString() ?? null : null;

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
  const rows = await prisma.marketListing.findMany({
    where: { active: true },
    select: { city: true, cityLabel: true },
    distinct: ["city"],
    orderBy: { cityLabel: "asc" },
    take: 200,
  });
  res.json({
    data: rows.map((r) => ({ city: r.city, label: r.cityLabel })),
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
