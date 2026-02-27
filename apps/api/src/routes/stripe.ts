import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_PRICE_ID_BR = process.env.STRIPE_PRICE_ID_BR;
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;

/** Normalize country to uppercase ISO 3166-1 alpha-2 for comparison. */
function normalizeCountry(country: string | null | undefined): string | null {
  const s = typeof country === "string" ? country.trim().toUpperCase() : "";
  return s.length === 2 ? s : null;
}

export const stripeRouter = Router();

/** POST /api/stripe/create-checkout-session – create Stripe Checkout Session for Pro subscription. */
stripeRouter.post(
  "/create-checkout-session",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) return;
    if (!stripe) {
      res.status(503).json({ error: "Payments are not configured" });
      return;
    }

    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true, country: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const country = normalizeCountry(user.country);
    let priceId: string | null = null;
    if (country === "BR") {
      const brPrice = process.env.STRIPE_PRICE_ID_BR?.trim();
      if (brPrice) priceId = brPrice;
      else {
        res.status(503).json({
          error: "Pro pricing for Brazil is not configured. Set STRIPE_PRICE_ID_BR in the server environment.",
        });
        return;
      }
    } else {
      priceId = STRIPE_PRICE_ID?.trim() ?? null;
    }
    if (!priceId) {
      res.status(503).json({ error: "Payments are not configured for your region" });
      return;
    }

    const successUrl = `${WEB_ORIGIN.replace(/\/$/, "")}/tiers?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${WEB_ORIGIN.replace(/\/$/, "")}/tiers?canceled=1`;

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: userId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { userId },
      },
    });

    if (!session.url) {
      res.status(500).json({ error: "Failed to create checkout session" });
      return;
    }
    res.json({ url: session.url });
  }
);

/** POST /api/stripe/create-portal-session – Stripe Customer Portal (manage/cancel subscription). */
stripeRouter.post(
  "/create-portal-session",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) return;
    if (!stripe) {
      res.status(503).json({ error: "Payments are not configured" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: "No subscription to manage" });
      return;
    }

    const returnUrl = `${WEB_ORIGIN.replace(/\/$/, "")}/tiers`;
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    if (!session.url) {
      res.status(500).json({ error: "Failed to open subscription management" });
      return;
    }
    res.json({ url: session.url });
  }
);

/** Webhook handler – must be mounted with express.raw({ type: "application/json" }) so body is Buffer. */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripe) {
    res.status(503).send("Webhook not configured");
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") {
    res.status(400).send("Missing stripe-signature");
    return;
  }

  const body = req.body as Buffer;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    res.status(400).send(message);
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { tier: "pro" },
        });
      }
    } else if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) {
        const status = sub.status;
        const tier = status === "active" || status === "trialing" ? "pro" : "free";
        await prisma.user.update({
          where: { id: userId },
          data: { tier },
        });
      }
    }
  } catch (e) {
    console.error("Stripe webhook handler error:", e);
    res.status(500).send("Webhook handler failed");
    return;
  }

  res.sendStatus(200);
}
