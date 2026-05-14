import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  isGooglePlayBillingConfigured,
  verifyGooglePlayPurchase,
} from "../lib/googlePlayBilling.js";
import {
  sendSubscriptionCancellationEmail,
  sendSubscriptionConfirmationEmail,
} from "../lib/email.js";

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

function subscriptionPeriodEndDate(sub: { current_period_end?: number }): Date | null {
  const t = sub.current_period_end;
  return t != null ? new Date(t * 1000) : null;
}

type StripeSubscriptionItemPrice = {
  id?: string;
  recurring?: { interval?: string | null } | null;
};
type StripeSubscriptionShape = {
  items?: { data?: Array<{ id?: string; price?: StripeSubscriptionItemPrice | null }> } | null;
  cancel_at_period_end?: boolean;
};

function subscriptionIntervalLabel(sub: StripeSubscriptionShape): "monthly" | "yearly" | null {
  const recurring = sub.items?.data?.[0]?.price?.recurring;
  if (recurring?.interval === "month") return "monthly";
  if (recurring?.interval === "year") return "yearly";
  return null;
}

function stripeCustomerIdString(
  customer: string | { id?: string } | null | undefined
): string | null {
  if (typeof customer === "string") return customer;
  return customer?.id ?? null;
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
      select: {
        tier: true,
        country: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        googlePlayPurchaseToken: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.tier === "admin") {
      res.status(400).json({ error: "Admin accounts do not need a subscription." });
      return;
    }

    if (user.tier === "pro" && user.stripeSubscriptionId) {
      res.status(409).json({
        error:
          "You already have an active Pro subscription. Use Manage subscription to open the billing portal and change or cancel your plan.",
      });
      return;
    }

    if (user.tier === "pro" && !user.stripeSubscriptionId && !user.googlePlayPurchaseToken) {
      res.status(409).json({
        error: "You already have Pro access on this account.",
      });
      return;
    }

    if (user.googlePlayPurchaseToken && isGooglePlayBillingConfigured()) {
      try {
        const play = await verifyGooglePlayPurchase(user.googlePlayPurchaseToken);
        if (play?.entitled) {
          res.status(409).json({
            error:
              "You already have an active subscription through Google Play. Open Subscriptions in the Play Store app to manage or cancel it before subscribing on the web.",
          });
          return;
        }
      } catch (e) {
        console.error("Stripe checkout: Google Play verify failed (not blocking checkout):", e);
      }
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

stripeRouter.post(
  "/confirm-checkout-session",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) return;
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payments are not configured" });
      return;
    }

    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });

      if (session.client_reference_id !== req.user.userId) {
        res.status(403).json({ error: "Session does not belong to this user" });
        return;
      }

      if (session.payment_status !== "paid") {
        res.status(409).json({ error: "Checkout session is not paid yet" });
        return;
      }

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!subscriptionId) {
        res.status(409).json({ error: "Session does not include a subscription" });
        return;
      }

      const subscription =
        typeof session.subscription === "object" && session.subscription
          ? (session.subscription as unknown as StripeSubscriptionShape & {
              customer: string | { id?: string } | null;
              current_period_end?: number;
            })
          : ((await stripe.subscriptions.retrieve(subscriptionId)) as unknown as StripeSubscriptionShape & {
              customer: string | { id?: string } | null;
              current_period_end?: number;
            });

      const customerId = stripeCustomerIdString(subscription.customer);
      const periodEnd = subscriptionPeriodEndDate(subscription);
      const intervalLabel = subscriptionIntervalLabel(subscription);

      const existing = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { tier: true },
      });
      await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          ...(existing?.tier !== "admin" ? { tier: "pro" as const } : {}),
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId ?? undefined,
          subscriptionEndsAt: periodEnd ?? undefined,
          subscriptionCancelAtPeriodEnd: false,
          ...(intervalLabel ? { subscriptionInterval: intervalLabel } : {}),
          googlePlayPurchaseToken: null,
          googlePlayProductId: null,
        },
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Stripe confirm-checkout-session error:", err);
      res.status(502).json({ error: "Could not confirm checkout session" });
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
      select: { stripeCustomerId: true, googlePlayPurchaseToken: true },
    });
    if (user?.googlePlayPurchaseToken && !user.stripeCustomerId) {
      res.status(400).json({
        error:
          "This account is billed through Google Play. Open the Play Store → Payments & subscriptions → Subscriptions to manage your plan.",
      });
      return;
    }
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
      select: {
        stripeSubscriptionId: true,
        email: true,
        username: true,
      },
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
      const claim = await prisma.user.updateMany({
        where: { id: userId, subscriptionCancelAtPeriodEnd: false },
        data: {
          subscriptionEndsAt: periodEnd ?? undefined,
          subscriptionCancelAtPeriodEnd: true,
        },
      });
      if (claim.count === 0 && periodEnd) {
        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionEndsAt: periodEnd },
        });
      }
      res.json({
        ok: true,
        subscriptionEndsAt: periodEnd?.toISOString() ?? null,
      });
      if (claim.count > 0 && user.email) {
        void sendSubscriptionCancellationEmail(user.email, {
          displayName: user.username,
          accessEndsAt: periodEnd,
        }).catch((mailErr) => {
          console.error("[stripe/cancel-subscription] cancellation email failed:", mailErr);
        });
      }
    } catch (err) {
      console.error("Stripe cancel-subscription error:", err);
      res.status(502).json({ error: "Could not cancel subscription" });
    }
  }
);

/** POST /stripe/resume-subscription - Undo a pending cancellation; optionally switch interval. */
stripeRouter.post(
  "/resume-subscription",
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
      select: { stripeSubscriptionId: true, country: true, subscriptionInterval: true },
    });
    if (!user?.stripeSubscriptionId) {
      res.status(400).json({ error: "No subscription to resume" });
      return;
    }

    const requestedInterval =
      req.body?.interval === "monthly" || req.body?.interval === "yearly"
        ? (req.body.interval as "monthly" | "yearly")
        : null;

    try {
      const current = (await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId
      )) as unknown as StripeSubscriptionShape & {
        current_period_end?: number;
      };

      const updateParams: Stripe.SubscriptionUpdateParams = {
        cancel_at_period_end: false,
      };

      let intentInterval: "monthly" | "yearly" | null = requestedInterval;
      if (requestedInterval) {
        const region = normalizeCountry(user.country);
        const newPriceId =
          region === "BR"
            ? requestedInterval === "yearly"
              ? PRICE_IDS.BR.yearly
              : PRICE_IDS.BR.monthly
            : requestedInterval === "yearly"
              ? PRICE_IDS.default.yearly
              : PRICE_IDS.default.monthly;

        if (!newPriceId) {
          res.status(503).json({ error: "Pricing not configured for your region/interval" });
          return;
        }

        const currentItem = current.items?.data?.[0];
        const currentItemId = currentItem?.id;
        const currentPriceId = currentItem?.price?.id ?? null;
        if (currentItemId && currentPriceId && currentPriceId !== newPriceId) {
          updateParams.items = [{ id: currentItemId, price: newPriceId }];
          updateParams.proration_behavior = "always_invoice";
        }
      } else {
        intentInterval = subscriptionIntervalLabel(current);
      }

      const updated = (await stripe.subscriptions.update(
        user.stripeSubscriptionId,
        updateParams
      )) as unknown as StripeSubscriptionShape & { current_period_end?: number };

      const periodEnd = subscriptionPeriodEndDate(updated);
      const intervalLabel = intentInterval ?? subscriptionIntervalLabel(updated);

      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionCancelAtPeriodEnd: false,
          subscriptionEndsAt: periodEnd ?? undefined,
          ...(intervalLabel ? { subscriptionInterval: intervalLabel } : {}),
        },
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("Stripe resume-subscription error:", err);
      res.status(502).json({ error: "Could not resume subscription" });
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

  let claim: { id: string };
  try {
    claim = await prisma.stripeWebhookEvent.create({
      data: { stripeEventId: event.id },
      select: { id: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      res.sendStatus(200);
      return;
    }
    console.error("Stripe webhook claim error:", e);
    res.status(500).send("Webhook claim failed");
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
        const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as
          StripeSubscriptionShape & {
            customer: string | { id?: string } | null;
            current_period_end?: number;
          };
        const customerId = stripeCustomerIdString(subscription.customer);
        const periodEnd = subscriptionPeriodEndDate(subscription);
        const intervalLabel = subscriptionIntervalLabel(subscription);
        const existing = await prisma.user.findUnique({
          where: { id: userId },
          select: { tier: true, email: true, username: true },
        });
        await prisma.user.update({
          where: { id: userId },
          data: {
            ...(existing?.tier !== "admin" ? { tier: "pro" as const } : {}),
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId ?? undefined,
            subscriptionEndsAt: periodEnd ?? undefined,
            subscriptionCancelAtPeriodEnd: false,
            ...(intervalLabel ? { subscriptionInterval: intervalLabel } : {}),
            googlePlayPurchaseToken: null,
            googlePlayProductId: null,
          },
        });
        if (existing && existing.tier !== "pro" && existing.email) {
          void sendSubscriptionConfirmationEmail(existing.email, {
            displayName: existing.username,
            interval: intervalLabel,
            nextRenewalAt: periodEnd,
          }).catch((mailErr) => {
            console.error(
              "[stripe webhook] subscription confirmation email failed:",
              mailErr
            );
          });
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id?: string } | null;
          billing_reason?: string | null;
        };
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id ?? null;
        if (!subscriptionId) break;
        if (invoice.billing_reason === "subscription_create") break;
        const subscription = (await stripe.subscriptions.retrieve(
          subscriptionId
        )) as unknown as StripeSubscriptionShape & { current_period_end?: number };
        const periodEnd = subscriptionPeriodEndDate(subscription);
        const intervalLabel = subscriptionIntervalLabel(subscription);
        if (!periodEnd) break;
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
          select: { id: true },
        });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionEndsAt: periodEnd,
              ...(intervalLabel ? { subscriptionInterval: intervalLabel } : {}),
            },
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription &
          StripeSubscriptionShape & { current_period_end?: number };
        const periodEnd = subscriptionPeriodEndDate(subscription);
        const intervalLabel = subscriptionIntervalLabel(subscription);
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
          select: { id: true, tier: true },
        });
        if (user) {
          const terminallyInactive =
            subscription.status === "canceled" ||
            subscription.status === "unpaid" ||
            subscription.status === "incomplete_expired";
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionEndsAt: periodEnd ?? undefined,
              subscriptionCancelAtPeriodEnd: !!subscription.cancel_at_period_end,
              ...(intervalLabel ? { subscriptionInterval: intervalLabel } : {}),
              ...(terminallyInactive
                ? {
                    stripeSubscriptionId: null,
                    subscriptionCancelAtPeriodEnd: false,
                    subscriptionInterval: null,
                    ...(user.tier !== "admin" ? { tier: "free" as const } : {}),
                  }
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
          select: { id: true, tier: true },
        });
        if (user) {
          const periodEnd = subscriptionPeriodEndDate(subscription) ?? new Date();
          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: null,
              subscriptionEndsAt: periodEnd,
              subscriptionCancelAtPeriodEnd: false,
              subscriptionInterval: null,
              ...(user.tier !== "admin" ? { tier: "free" as const } : {}),
            },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (handlerErr) {
    console.error("Stripe webhook handler error:", handlerErr);
    await prisma.stripeWebhookEvent.delete({ where: { id: claim.id } }).catch(() => {
      /* best-effort release so Stripe retry can reprocess */
    });
    res.status(500).send("Webhook handler failed");
    return;
  }

  res.sendStatus(200);
}
