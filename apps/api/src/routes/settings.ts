import { Router } from "express";
import { z } from "zod";
import {
  ANIME_MANGA_TITLE_LANGUAGES,
  BOARD_GAME_PROVIDERS,
  MEDIA_TYPES,
  mergeProfileVisibility,
  resolveAnimeMangaTitleLanguage,
  type ProfileVisibility,
} from "@geeklogs/shared";
import { getProfileVisibilityFromUser } from "../lib/profileVisibility.js";
import { prisma } from "../lib/prisma.js";
import { sanitizeApiKey, sanitizeText } from "../lib/sanitize.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { setSelectedBadges } from "../services/gamification.service.js";

const onboardingSchema = z.object({
  theme: z.enum(["light", "dark"]),
  types: z.array(z.enum(MEDIA_TYPES as unknown as [string, ...string[]])),
  boardGameProvider: z.enum(BOARD_GAME_PROVIDERS as unknown as [string, ...string[]]).optional(),
  animeMangaTitleLanguage: z.enum(ANIME_MANGA_TITLE_LANGUAGES as unknown as [string, ...string[]]).optional(),
  locale: z.enum(["en", "pt-BR", "es"]).optional(),
});

export const settingsRouter = Router();

settingsRouter.use(authMiddleware);

const apiKeysSchema = z.object({
  tmdb: z.string().min(1).max(512).optional(),
  rawg: z.string().min(1).max(512).optional(),
  bgg: z.string().min(1).max(512).optional(),
  ludopedia: z.string().min(1).max(512).optional(),
  comicvine: z.string().min(1).max(512).optional(),
});

const boardGameProviderSchema = z.object({
  provider: z.enum(["bgg", "ludopedia"]),
});

const animeMangaTitleLanguageSchema = z.object({
  language: z.enum(ANIME_MANGA_TITLE_LANGUAGES as unknown as [string, ...string[]]),
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
      ludopediaApiToken: true,
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
    ludopedia: !!user.ludopediaApiToken,
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
  const data: {
    tmdbApiKey?: string;
    rawgApiKey?: string;
    bggApiToken?: string;
    ludopediaApiToken?: string;
    comicVineApiKey?: string;
  } = {};
  if (parsed.data.tmdb !== undefined) {
    const v = sanitizeApiKey(parsed.data.tmdb);
    if (v) data.tmdbApiKey = v;
  }
  if (parsed.data.rawg !== undefined) {
    const v = sanitizeApiKey(parsed.data.rawg);
    if (v) data.rawgApiKey = v;
  }
  if (parsed.data.bgg !== undefined) {
    const v = sanitizeApiKey(parsed.data.bgg);
    if (v) data.bggApiToken = v;
  }
  if (parsed.data.ludopedia !== undefined) {
    const v = sanitizeApiKey(parsed.data.ludopedia);
    if (v) data.ludopediaApiToken = v;
  }
  if (parsed.data.comicvine !== undefined) {
    const v = sanitizeApiKey(parsed.data.comicvine);
    if (v) data.comicVineApiKey = v;
  }
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

const recapEmailsSchema = z.object({
  enabled: z.boolean(),
});

/** Save whether to receive monthly recap emails. */
settingsRouter.put("/recap-emails", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = recapEmailsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await prisma.user.update({
    where: { id: req.user.userId },
    data: { recapEmailsEnabled: parsed.data.enabled },
  });
  res.json({ ok: true, enabled: parsed.data.enabled });
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

/** Get user's board game provider preference (bgg | ludopedia). */
settingsRouter.get("/board-game-provider", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { boardGameProvider: true },
  });
  const provider = user?.boardGameProvider === "ludopedia" ? "ludopedia" : "bgg";
  res.json({ provider });
});

/** Save user's board game provider preference. */
settingsRouter.put("/board-game-provider", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = boardGameProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await prisma.user.update({
    where: { id: req.user.userId },
    data: { boardGameProvider: parsed.data.provider },
  });
  res.json({ ok: true, provider: parsed.data.provider });
});

settingsRouter.get("/anime-manga-title-language", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { animeMangaTitleLanguage: true },
  });
  const language = resolveAnimeMangaTitleLanguage(user?.animeMangaTitleLanguage);
  res.json({ language });
});

settingsRouter.put("/anime-manga-title-language", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = animeMangaTitleLanguageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await prisma.user.update({
    where: { id: req.user.userId },
    data: { animeMangaTitleLanguage: parsed.data.language },
  });
  res.json({ ok: true, language: parsed.data.language });
});

const profileBadgesSchema = z.object({
  badgeIds: z.array(z.string().min(1)).max(3),
});

/** GET /settings/profile-badges - Get currently selected profile badge IDs (up to 3). */
settingsRouter.get("/profile-badges", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { selectedBadgeIds: true },
  });
  let badgeIds: string[] = [];
  if (user?.selectedBadgeIds) {
    try {
      const parsed = JSON.parse(user.selectedBadgeIds) as unknown;
      badgeIds = Array.isArray(parsed) ? parsed.slice(0, 3) : [];
    } catch {
      // ignore
    }
  }
  res.json({ badgeIds });
});

/** PUT /settings/profile-badges - Set up to 3 badges to display on profile. */
settingsRouter.put("/profile-badges", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = profileBadgesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body: badgeIds must be an array of up to 3 badge IDs" });
    return;
  }
  await setSelectedBadges(req.user.userId, parsed.data.badgeIds);
  res.json({ ok: true, badgeIds: parsed.data.badgeIds });
});

const profileVisibilitySchema = z.object({
  showPublicProfile: z.boolean(),
  showLogCount: z.boolean(),
  showPinnedBadges: z.boolean(),
  showMilestoneBadges: z.boolean(),
  showStatus: z.boolean(),
  showRatings: z.boolean(),
  showReviews: z.boolean(),
  showGenres: z.boolean(),
  showApiScores: z.boolean(),
  showProgress: z.boolean(),
  showCompletionTime: z.boolean(),
  showCollectionTags: z.boolean(),
  showTvMetadata: z.boolean(),
  showEnrichmentDetails: z.boolean(),
});

/** GET /settings/profile-visibility — what visitors see on the public profile. */
settingsRouter.get("/profile-visibility", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { profileVisibility: true },
  });
  res.json(getProfileVisibilityFromUser(user ?? { profileVisibility: null }));
});

/** PUT /settings/profile-visibility */
settingsRouter.put("/profile-visibility", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = profileVisibilitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile visibility settings" });
    return;
  }
  const merged = mergeProfileVisibility(parsed.data as ProfileVisibility);
  await prisma.user.update({
    where: { id: req.user.userId },
    data: { profileVisibility: JSON.stringify(merged) },
  });
  res.json(merged);
});

const userProfileSchema = z.object({
  city: z.string().min(1).max(128).trim(),
  cityLabel: z.string().min(1).max(256).trim(),
  country: z.string().max(2).optional(),
  phone: z.string().max(32).optional(),
});

settingsRouter.put("/user-profile", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = userProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const city = sanitizeText(parsed.data.city, 128) ?? parsed.data.city.slice(0, 128);
  const cityLabel = sanitizeText(parsed.data.cityLabel, 256) ?? parsed.data.cityLabel.slice(0, 256);
  const country =
    parsed.data.country && parsed.data.country.trim().length === 2
      ? String(parsed.data.country).toUpperCase().slice(0, 2)
      : null;
  const phone = parsed.data.phone?.trim()
    ? sanitizeText(parsed.data.phone.trim(), 32) ?? parsed.data.phone.trim().slice(0, 32)
    : null;
  const updated = await prisma.user.update({
    where: { id: req.user.userId },
    data: {
      city,
      cityLabel,
      ...(country ? { country } : { country: null }),
      phone,
    },
    select: {
      city: true,
      cityLabel: true,
      country: true,
      phone: true,
    },
  });
  res.json(updated);
});

/** Complete onboarding: set theme, visible media types, and onboarded = true. */
settingsRouter.put("/onboarding", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const typesSet = new Set(parsed.data.types);
  const data: {
    preferredTheme: "light" | "dark";
    visibleMediaTypes: string;
    onboarded: boolean;
    boardGameProvider?: string;
    animeMangaTitleLanguage?: string;
    preferredLocale?: string;
  } = {
    preferredTheme: parsed.data.theme,
    visibleMediaTypes: JSON.stringify(parsed.data.types),
    onboarded: true,
  };
  if (typesSet.has("boardgames")) {
    data.boardGameProvider = parsed.data.boardGameProvider ?? "bgg";
  }
  if (typesSet.has("anime") || typesSet.has("manga")) {
    data.animeMangaTitleLanguage = parsed.data.animeMangaTitleLanguage ?? "original";
  }
  if (parsed.data.locale) {
    data.preferredLocale = parsed.data.locale;
  }

  await prisma.user.update({
    where: { id: req.user.userId },
    data,
  });
  res.json({ ok: true });
});
