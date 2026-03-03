import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

const PRICE_IDS = {
  default: {
    monthly: process.env.STRIPE_PRICE_ID_MONTHLY?.trim() ?? null,
    yearly: process.env.STRIPE_PRICE_ID_YEARLY?.trim() ?? null,
  },
  BR: {
    monthly: process.env.STRIPE_PRICE_ID_BR_MONTHLY?.trim() ?? null,
    yearly: process.env.STRIPE_PRICE_ID_BR_YEARLY?.trim() ?? null,
  },
};

function normalizeCountry(country: string | null | undefined): "BR" | "default" {
  const s = typeof country === "string" ? country.trim().toUpperCase() : "";
  return s === "BR" ? "BR" : "default";
}

function getStripe(): Stripe | null {
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey);
}

export const stripeRouter = Router();

/** POST /stripe/create-checkout-session - Create Stripe Checkout Session for subscription. */
stripeRouter.post(
  "/create-checkout-session",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) return;
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payments are not configured" });
      return;
    }

    const interval = (req.body?.interval === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { country: true, email: true, stripeCustomerId: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const region = normalizeCountry(user.country);
    const priceId = region === "BR"
      ? (interval === "yearly" ? PRICE_IDS.BR.yearly : PRICE_IDS.BR.monthly)
      : (interval === "yearly" ? PRICE_IDS.default.yearly : PRICE_IDS.default.monthly);

    if (!priceId) {
      res.status(503).json({
        error: region === "BR"
          ? "Pro pricing for Brazil is not configured. Set STRIPE_PRICE_ID_BR_MONTHLY and STRIPE_PRICE_ID_BR_YEARLY."
          : "Payments are not configured for your region.",
      });
      return;
    }

    const baseUrl = WEB_ORIGIN.replace(/\/$/, "");

    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        client_reference_id: userId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/tiers?approved=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/tiers?canceled=1`,
        subscription_data: {
          metadata: { userId },
        },
      };
      if (user.email) sessionParams.customer_email = user.email;
      if (user.stripeCustomerId) sessionParams.customer = user.stripeCustomerId;

      const session = await stripe.checkout.sessions.create(sessionParams);
      if (!session.url) {
        res.status(500).json({ error: "Failed to create checkout session" });
        return;
      }
      res.json({ url: session.url });
    } catch (err) {
      console.error("Stripe create-checkout-session error:", err);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  }
);

/** POST /stripe/create-portal-session - Create Stripe Customer Billing Portal session (manage/cancel). */
stripeRouter.post(
  "/create-portal-session",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) return;
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payments are not configured" });
      return;
    }

    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: "No subscription to manage" });
      return;
    }

    const baseUrl = WEB_ORIGIN.replace(/\/$/, "");
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/tiers`,
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error("Stripe create-portal-session error:", err);
      res.status(500).json({ error: "Failed to open billing portal" });
    }
  }
);

/** POST /stripe/cancel-subscription - Cancel subscription at period end. */
stripeRouter.post(
  "/cancel-subscription",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) return;
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payments are not configured" });
      return;
    }

    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeSubscriptionId: true },
    });
    if (!user?.stripeSubscriptionId) {
      res.status(400).json({ error: "No active subscription" });
      return;
    }

    try {
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      }) as unknown as { current_period_end?: number };
      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null;
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionEndsAt: periodEnd ?? undefined },
      });
      res.json({
        ok: true,
        subscriptionEndsAt: periodEnd?.toISOString() ?? null,
      });
    } catch (err) {
      console.error("Stripe cancel-subscription error:", err);
      res.status(502).json({ error: "Could not cancel subscription" });
    }
  }
);

/** Stripe webhook handler - must use raw body; register in index before express.json(). */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!stripeWebhookSecret || !stripeSecretKey) {
    res.status(503).send("Webhook not configured");
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") {
    res.status(400).send("Missing stripe-signature");
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(503).send("Webhook not configured");
    return;
  }

  const rawBody = req.body as Buffer;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    res.status(400).send(message);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
        if (!userId || !subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as {
          customer: string | { id?: string } | null;
          current_period_end?: number;
        };
        const customerId = typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? null;
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null;
        await prisma.user.update({
          where: { id: userId },
          data: {
            tier: "pro",
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId ?? undefined,
            subscriptionEndsAt: periodEnd ?? undefined,
          },
        });
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription & { current_period_end?: number };
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null;
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
          select: { id: true },
        });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionEndsAt: periodEnd ?? undefined,
              ...(subscription.status !== "active" && subscription.status !== "trialing"
                ? { tier: "free" as const, stripeSubscriptionId: null }
                : {}),
            },
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription & { current_period_end?: number };
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
          select: { id: true },
        });
        if (user) {
          const periodEnd = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : new Date();
          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: null,
              subscriptionEndsAt: periodEnd,
            },
          });
        }
        break;
      }
      default:
        // ignore other events
        break;
    }
  } catch (e) {
    console.error("Stripe webhook handler error:", e);
    res.status(500).send("Webhook handler failed");
    return;
  }

  res.sendStatus(200);
}
