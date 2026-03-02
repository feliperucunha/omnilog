import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

/**
 * Run subscription expiry: set tier to free for Pro users whose subscriptionEndsAt is in the past.
 * Pro users with subscriptionEndsAt = null are never expired (endless Pro, e.g. for testing).
 * Used in-process (startup + every 24h) and by GET /api/cron/subscriptions for manual trigger.
 */
export async function runSubscriptionExpiry(): Promise<number> {
  const now = new Date();
  const result = await prisma.user.updateMany({
    where: {
      tier: "pro",
      subscriptionEndsAt: { not: null, lt: now },
    },
    data: {
      tier: "free",
      subscriptionEndsAt: null,
    },
  });
  return result.count;
}

/**
 * GET /api/cron/subscriptions – manually trigger expiry (optional). Requires ?secret=CRON_SECRET.
 * Expiry also runs automatically on server startup and every 24h, so no external cron needed.
 */
export const cronRouter = Router();

cronRouter.get("/subscriptions", async (req: Request, res: Response): Promise<void> => {
  const secret = typeof req.query.secret === "string" ? req.query.secret : "";
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const expired = await runSubscriptionExpiry();
  res.json({ ok: true, expired });
});
