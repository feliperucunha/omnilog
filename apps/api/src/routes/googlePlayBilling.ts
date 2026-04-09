import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  getExpectedGooglePlayProductIds,
  isAllowedGooglePlayProductId,
  isGooglePlayBillingConfigured,
  verifyGooglePlayPurchase,
} from "../lib/googlePlayBilling.js";

export const googlePlayBillingRouter = Router();

const verifyBodySchema = z.object({
  purchaseToken: z.string().min(10).max(4096),
  productId: z.string().min(1).max(256),
});

/**
 * POST /billing/google-play/verify
 * Body: { purchaseToken, productId } — after a successful in-app purchase on Android.
 */
googlePlayBillingRouter.post(
  "/verify",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) return;

    if (!isGooglePlayBillingConfigured()) {
      res.status(503).json({ error: "Google Play billing is not configured" });
      return;
    }

    const { monthly: pidMonthly, yearly: pidYearly } = getExpectedGooglePlayProductIds();
    if (!pidMonthly && !pidYearly) {
      res.status(503).json({
        error: "Google Play subscription product IDs are not configured on the server.",
      });
      return;
    }

    const parsed = verifyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { purchaseToken, productId } = parsed.data;
    if (!isAllowedGooglePlayProductId(productId)) {
      res.status(400).json({ error: "Unknown subscription product" });
      return;
    }

    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true, stripeSubscriptionId: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.tier === "admin") {
      res.json({ ok: true, tier: "admin", message: "Admin tier unchanged" });
      return;
    }

    if (user.stripeSubscriptionId) {
      res.status(409).json({
        error:
          "You have an active web subscription. Cancel it in the billing portal before subscribing with Google Play.",
      });
      return;
    }

    const existingOwner = await prisma.user.findFirst({
      where: { googlePlayPurchaseToken: purchaseToken },
      select: { id: true },
    });
    if (existingOwner && existingOwner.id !== userId) {
      res.status(409).json({
        error: "This purchase is already linked to another account.",
      });
      return;
    }

    let outcome;
    try {
      outcome = await verifyGooglePlayPurchase(purchaseToken, { acknowledge: true });
    } catch (e) {
      console.error("Google Play verify API error:", e);
      res.status(502).json({ error: "Could not verify purchase with Google" });
      return;
    }

    if (!outcome) {
      res.status(503).json({ error: "Google Play billing is not configured" });
      return;
    }

    if (!outcome.entitled) {
      const state = outcome.subscriptionState ?? "unknown";
      res.status(400).json({
        error: `This subscription is not active (${state}).`,
      });
      return;
    }

    if (!outcome.lineItemProductIds.includes(productId)) {
      res.status(400).json({
        error: "The purchase does not match the selected subscription product.",
      });
      return;
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          tier: "pro" as const,
          googlePlayPurchaseToken: purchaseToken,
          googlePlayProductId: productId,
          subscriptionEndsAt: outcome.expiry ?? undefined,
          stripeSubscriptionId: null,
          stripeCustomerId: null,
        },
      });
    } catch (e) {
      console.error("Google Play verify: database update failed:", e);
      res.status(502).json({
        error:
          "Purchase was verified with Google but we could not update your account. Please try again in a moment.",
      });
      return;
    }

    res.json({
      ok: true,
      tier: "pro" as const,
      subscriptionEndsAt: outcome.expiry?.toISOString() ?? null,
    });
  }
);
