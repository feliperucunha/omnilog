import { Router } from "express";
import { MEDIA_TYPES } from "@dogument/shared";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getMilestoneProgress } from "../services/milestone.service.js";

export const meRouter = Router();

meRouter.use(authMiddleware);

/** GET /me/milestones/progress - Per-medium and global milestone progress (reviews + logs). Simple next-milestone + progress. */
meRouter.get("/milestones/progress", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const data = await getMilestoneProgress(req.user.userId);
  res.json(data);
});

/** GET /me/badges - List badges the current user has earned. */
meRouter.get("/badges", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const userBadges = await prisma.userBadge.findMany({
    where: { userId: req.user.userId },
    include: { badge: true },
    orderBy: { earnedAt: "desc" },
  });
  res.json({
    data: userBadges.map((ub) => ({
      id: ub.badge.id,
      name: ub.badge.name,
      description: ub.badge.description,
      icon: ub.badge.icon,
      medium: ub.badge.medium,
      rarity: ub.badge.rarity,
      earnedAt: ub.earnedAt.toISOString(),
    })),
  });
});

/** Get current user and all settings in one call. */
meRouter.get("/", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      username: true,
      email: true,
      onboarded: true,
      tier: true,
      subscriptionEndsAt: true,
      preferredTheme: true,
      preferredLocale: true,
      visibleMediaTypes: true,
      boardGameProvider: true,
      country: true,
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

  const logCount = await prisma.log.count({ where: { userId: user.id } });
  const theme = user.preferredTheme === "light" ? "light" : "dark";
  const locale =
    user.preferredLocale && ["en", "pt-BR", "es"].includes(user.preferredLocale)
      ? user.preferredLocale
      : "en";

  let visibleMediaTypes: string[] = [...MEDIA_TYPES];
  if (user.visibleMediaTypes) {
    try {
      const parsed = JSON.parse(user.visibleMediaTypes) as string[];
      const valid = parsed.filter((t): t is (typeof MEDIA_TYPES)[number] =>
        MEDIA_TYPES.includes(t as (typeof MEDIA_TYPES)[number])
      );
      if (valid.length > 0) visibleMediaTypes = valid;
    } catch {
      // keep default
    }
  }

  const boardGameProvider = user.boardGameProvider === "ludopedia" ? "ludopedia" : "bgg";
  const tier = user.tier === "pro" ? "pro" : "free";
  const subscriptionEndsAt = user.subscriptionEndsAt?.toISOString() ?? null;
  const daysRemaining =
    subscriptionEndsAt && tier === "pro"
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscriptionEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
          )
        )
      : null;

  res.json({
    user: {
      id: user.id,
      username: user.username ?? undefined,
      email: user.email,
      onboarded: user.onboarded,
    },
    theme,
    locale,
    visibleMediaTypes,
    boardGameProvider,
    tier,
    subscriptionEndsAt,
    daysRemaining,
    country: user.country ?? undefined,
    logCount,
    apiKeys: {
      tmdb: !!user.tmdbApiKey,
      rawg: !!user.rawgApiKey,
      bgg: !!user.bggApiToken,
      ludopedia: !!user.ludopediaApiToken,
      comicvine: !!user.comicVineApiKey,
    },
  });
});
