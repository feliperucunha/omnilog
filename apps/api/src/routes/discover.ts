import { Router, type Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  DISCOVER_TASTE_REFRESH_MS,
  MEDIA_TYPES,
  type BoardGameProvider,
  type DiscoverTasteSnapshot,
  type MediaType,
} from "@geeklogs/shared";
import { prisma } from "../lib/prisma.js";
import { parseStoredDiscoverTasteSnapshot } from "../lib/discoverTaste.js";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";
import { generateDiscoverTasteSnapshot } from "../services/discoverTaste.js";
import { AiGenerationError, AiUnavailableError, isAiConfigured } from "../services/ai.js";

const EMPTY_SNAPSHOT: DiscoverTasteSnapshot = { refreshedAt: null, categories: {} };

const tasteBodySchema = z
  .object({
    locale: z.string().min(2).max(20).optional(),
    mediaTypes: z.array(z.enum(MEDIA_TYPES as unknown as [MediaType, ...MediaType[]])).optional(),
  })
  .default({});

function isFresh(snapshot: DiscoverTasteSnapshot): boolean {
  if (!snapshot.refreshedAt) return false;
  const at = Date.parse(snapshot.refreshedAt);
  return Number.isFinite(at) && Date.now() - at < DISCOVER_TASTE_REFRESH_MS;
}

async function readSnapshot(userId: string): Promise<DiscoverTasteSnapshot> {
  const row = await prisma.discoverTasteSnapshot.findUnique({ where: { userId } });
  if (!row) return EMPTY_SNAPSHOT;
  return (
    parseStoredDiscoverTasteSnapshot({
      refreshedAt: row.refreshedAt.toISOString(),
      categories: row.categories,
    }) ?? EMPTY_SNAPSHOT
  );
}

export const discoverRouter = Router();
discoverRouter.use(authMiddleware);

discoverRouter.get("/taste", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) return;
  res.json(await readSnapshot(req.user.userId));
});

discoverRouter.post("/taste", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) return;
  const parsed = tasteBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Discover request" });
    return;
  }

  const existing = await readSnapshot(req.user.userId);
  if (isFresh(existing)) {
    res.json(existing);
    return;
  }
  if (!isAiConfigured()) {
    res.status(503).json({ error: "AI is not configured on this server", code: "AI_UNAVAILABLE" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { preferredLocale: true, boardGameProvider: true },
  });

  try {
    const snapshot = await generateDiscoverTasteSnapshot(
      req.user.userId,
      parsed.data.locale ?? user?.preferredLocale ?? "en",
      parsed.data.mediaTypes ?? [...MEDIA_TYPES],
      (user?.boardGameProvider as BoardGameProvider | undefined) ?? "bgg"
    );
    const refreshedAt = new Date(snapshot.refreshedAt ?? Date.now());
    await prisma.discoverTasteSnapshot.upsert({
      where: { userId: req.user.userId },
      create: {
        userId: req.user.userId,
        categories: snapshot.categories as Prisma.InputJsonValue,
        refreshedAt,
      },
      update: {
        categories: snapshot.categories as Prisma.InputJsonValue,
        refreshedAt,
      },
    });
    res.json({ ...snapshot, refreshedAt: refreshedAt.toISOString() });
  } catch (error) {
    if (error instanceof AiUnavailableError || error instanceof AiGenerationError) {
      res.status(error instanceof AiUnavailableError ? 503 : 502).json({ error: error.message, code: error.code });
      return;
    }
    console.error("Discover taste generation failed", error);
    res.status(502).json({ error: "Could not generate Discover taste", code: "AI_GENERATION_FAILED" });
  }
});
