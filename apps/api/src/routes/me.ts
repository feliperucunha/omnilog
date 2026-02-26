import { Router } from "express";
import { MEDIA_TYPES } from "@logeverything/shared";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const meRouter = Router();

meRouter.use(authMiddleware);

/** Get current user and all settings in one call. */
meRouter.get("/", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      onboarded: true,
      tier: true,
      preferredTheme: true,
      preferredLocale: true,
      visibleMediaTypes: true,
      boardGameProvider: true,
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

  res.json({
    user: {
      id: user.id,
      email: user.email,
      onboarded: user.onboarded,
    },
    theme,
    locale,
    visibleMediaTypes,
    boardGameProvider,
    tier,
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
