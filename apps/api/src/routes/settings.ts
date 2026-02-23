import { Router } from "express";
import { z } from "zod";
import { MEDIA_TYPES } from "@logeverything/shared";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const onboardingSchema = z.object({
  theme: z.enum(["light", "dark"]),
  types: z.array(z.enum(MEDIA_TYPES as unknown as [string, ...string[]])),
});

export const settingsRouter = Router();

settingsRouter.use(authMiddleware);

const apiKeysSchema = z.object({
  tmdb: z.string().min(1).optional(),
  rawg: z.string().min(1).optional(),
  bgg: z.string().min(1).optional(),
  comicvine: z.string().min(1).optional(),
});

/** Get which API keys the user has set (no values returned). */
settingsRouter.get("/api-keys", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      tmdbApiKey: true,
      rawgApiKey: true,
      bggApiToken: true,
      comicVineApiKey: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    tmdb: !!user.tmdbApiKey,
    rawg: !!user.rawgApiKey,
    bgg: !!user.bggApiToken,
    comicvine: !!user.comicVineApiKey,
  });
});

/** Save API keys to the user's account. */
settingsRouter.put("/api-keys", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = apiKeysSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const data: { tmdbApiKey?: string; rawgApiKey?: string; bggApiToken?: string; comicVineApiKey?: string } = {};
  if (parsed.data.tmdb !== undefined) data.tmdbApiKey = parsed.data.tmdb;
  if (parsed.data.rawg !== undefined) data.rawgApiKey = parsed.data.rawg;
  if (parsed.data.bgg !== undefined) data.bggApiToken = parsed.data.bgg;
  if (parsed.data.comicvine !== undefined) data.comicVineApiKey = parsed.data.comicvine;
  await prisma.user.update({
    where: { id: req.user.userId },
    data,
  });
  res.json({ ok: true });
});

const themeSchema = z.object({
  theme: z.enum(["light", "dark"]),
});

/** Get user's preferred theme. */
settingsRouter.get("/theme", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { preferredTheme: true },
  });
  res.json({
    theme: user?.preferredTheme === "light" ? "light" : "dark",
  });
});

/** Save user's preferred theme. */
settingsRouter.put("/theme", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = themeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await prisma.user.update({
    where: { id: req.user.userId },
    data: { preferredTheme: parsed.data.theme },
  });
  res.json({ ok: true, theme: parsed.data.theme });
});

const localeSchema = z.object({
  locale: z.enum(["en", "pt-BR", "es"]),
});

/** Get user's preferred locale. */
settingsRouter.get("/locale", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { preferredLocale: true },
  });
  const locale = user?.preferredLocale && ["en", "pt-BR", "es"].includes(user.preferredLocale)
    ? user.preferredLocale
    : "en";
  res.json({ locale });
});

/** Save user's preferred locale. */
settingsRouter.put("/locale", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = localeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await prisma.user.update({
    where: { id: req.user.userId },
    data: { preferredLocale: parsed.data.locale },
  });
  res.json({ ok: true, locale: parsed.data.locale });
});

const visibleMediaTypesSchema = z.object({
  types: z.array(z.enum(MEDIA_TYPES as unknown as [string, ...string[]])),
});

/** Get visible media types for sidebar and search (default: all). */
settingsRouter.get("/visible-media-types", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { visibleMediaTypes: true },
  });
  if (!user?.visibleMediaTypes) {
    return res.json({ types: [...MEDIA_TYPES] });
  }
  try {
    const parsed = JSON.parse(user.visibleMediaTypes) as string[];
    const valid = parsed.filter((t): t is (typeof MEDIA_TYPES)[number] =>
      MEDIA_TYPES.includes(t as (typeof MEDIA_TYPES)[number])
    );
    return res.json({ types: valid.length > 0 ? valid : [...MEDIA_TYPES] });
  } catch {
    return res.json({ types: [...MEDIA_TYPES] });
  }
});

/** Save visible media types. */
settingsRouter.put("/visible-media-types", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = visibleMediaTypesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await prisma.user.update({
    where: { id: req.user.userId },
    data: { visibleMediaTypes: JSON.stringify(parsed.data.types) },
  });
  res.json({ ok: true, types: parsed.data.types });
});

/** Complete onboarding: set theme, visible media types, and onboarded = true. */
settingsRouter.put("/onboarding", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await prisma.user.update({
    where: { id: req.user.userId },
    data: {
      preferredTheme: parsed.data.theme,
      visibleMediaTypes: JSON.stringify(parsed.data.types),
      onboarded: true,
    },
  });
  res.json({ ok: true });
});
