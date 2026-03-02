import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID?.trim();
const PAYPAL_SECRET = process.env.PAYPAL_CLIENT_SECRET?.trim();
const PAYPAL_PLAN_ID = process.env.PAYPAL_PLAN_ID?.trim();
const PAYPAL_PLAN_ID_YEARLY = process.env.PAYPAL_PLAN_ID_YEARLY?.trim();
const PAYPAL_PLAN_ID_BR = process.env.PAYPAL_PLAN_ID_BR?.trim();
const PAYPAL_PLAN_ID_BR_YEARLY = process.env.PAYPAL_PLAN_ID_BR_YEARLY?.trim();
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID?.trim();
const PAYPAL_SANDBOX = process.env.PAYPAL_SANDBOX === "true";
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:5173";

const PAYPAL_BASE = PAYPAL_SANDBOX
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

function normalizeCountry(country: string | null | undefined): string | null {
  const s = typeof country === "string" ? country.trim().toUpperCase() : "";
  return s.length === 2 ? s : null;
}

async function getPayPalAccessToken(): Promise<string | null> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) return null;
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

const YEARLY_PLAN_IDS = new Set(
  [PAYPAL_PLAN_ID_YEARLY, PAYPAL_PLAN_ID_BR_YEARLY].filter(Boolean) as string[]
);

async function getSubscriptionPeriodEnd(
  token: string,
  subscriptionId: string
): Promise<Date | null> {
  const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const sub = (await res.json()) as {
    plan_id?: string;
    start_time?: string;
    billing_info?: { next_billing_time?: string };
  };
  const next = sub.billing_info?.next_billing_time;
  if (next) {
    const d = new Date(next);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const start = sub.start_time;
  if (start) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) {
      const isYearly = sub.plan_id ? YEARLY_PLAN_IDS.has(sub.plan_id) : false;
      if (isYearly) d.setUTCFullYear(d.getUTCFullYear() + 1);
      else d.setUTCMonth(d.getUTCMonth() + 1);
      return d;
    }
  }
  return null;
}

export const paypalRouter = Router();

paypalRouter.post(
  "/create-subscription",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) return;
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      res.status(503).json({ error: "Payments are not configured" });
      return;
    }

    const interval = (req.body?.interval === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const country = normalizeCountry(user.country);
    let planId: string | null = null;
    if (country === "BR") {
      planId = interval === "yearly" ? (PAYPAL_PLAN_ID_BR_YEARLY ?? PAYPAL_PLAN_ID_BR) : PAYPAL_PLAN_ID_BR;
    } else {
      planId = interval === "yearly" ? (PAYPAL_PLAN_ID_YEARLY ?? PAYPAL_PLAN_ID) : PAYPAL_PLAN_ID;
    }
    if (!planId) {
      if (country === "BR") {
        res.status(503).json({
          error: "Pro pricing for Brazil is not configured. Set PAYPAL_PLAN_ID_BR (and PAYPAL_PLAN_ID_BR_YEARLY for yearly) in the server environment.",
        });
        return;
      }
      res.status(503).json({ error: "Payments are not configured for your region" });
      return;
    }

    const baseUrl = WEB_ORIGIN.replace(/\/$/, "");
    const token = await getPayPalAccessToken();
    if (!token) {
      res.status(503).json({ error: "Payments are not configured" });
      return;
    }

    const body = {
      plan_id: planId,
      custom_id: userId,
      application_context: {
        brand_name: "Log Everything",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${baseUrl}/tiers?approved=1`,
        cancel_url: `${baseUrl}/tiers?canceled=1`,
      },
    };

    const createRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("PayPal create subscription error:", createRes.status, errText);
      res.status(500).json({ error: "Failed to create subscription" });
      return;
    }

    const sub = (await createRes.json()) as {
      id?: string;
      links?: Array<{ rel: string; href: string }>;
    };
    const approveLink = sub.links?.find((l) => l.rel === "approve");
    if (!approveLink?.href) {
      res.status(500).json({ error: "Failed to create checkout session" });
      return;
    }
    res.json({ url: approveLink.href });
  }
);

paypalRouter.post(
  "/create-portal-session",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) return;
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { paypalSubscriptionId: true },
    });
    if (!user?.paypalSubscriptionId) {
      res.status(400).json({ error: "No subscription to manage" });
      return;
    }
    const manageUrl = PAYPAL_SANDBOX
      ? "https://www.sandbox.paypal.com/myaccount/autopay/"
      : "https://www.paypal.com/myaccount/autopay/";
    res.json({ url: manageUrl });
  }
);

export async function handlePayPalWebhook(req: Request, res: Response): Promise<void> {
  if (!PAYPAL_WEBHOOK_ID || !PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    res.status(503).send("Webhook not configured");
    return;
  }

  const transmissionId = req.headers["paypal-transmission-id"];
  const transmissionSig = req.headers["paypal-transmission-sig"];
  const transmissionTime = req.headers["paypal-transmission-time"];
  const authAlgo = req.headers["paypal-auth-algo"];
  const certUrl = req.headers["paypal-cert-url"];

  if (
    typeof transmissionId !== "string" ||
    typeof transmissionSig !== "string" ||
    typeof transmissionTime !== "string" ||
    typeof authAlgo !== "string" ||
    typeof certUrl !== "string"
  ) {
    res.status(400).send("Missing PayPal webhook headers");
    return;
  }

  const rawBody = req.body as Buffer;
  let event: {
    event_type?: string;
    resource?: {
      id?: string;
      custom_id?: string;
      billing_agreement_id?: string;
    };
  };
  try {
    event = JSON.parse(rawBody.toString("utf8")) as typeof event;
  } catch {
    res.status(400).send("Invalid JSON");
    return;
  }

  const token = await getPayPalAccessToken();
  if (!token) {
    res.status(503).send("Webhook not configured");
    return;
  }

  const verifyRes = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  });

  if (!verifyRes.ok) {
    res.status(400).send("Verification failed");
    return;
  }

  const verifyData = (await verifyRes.json()) as { verification_status?: string };
  if (verifyData.verification_status !== "SUCCESS") {
    res.status(400).send("Invalid signature");
    return;
  }

  const eventType = event.event_type;
  const resource = event.resource;
  const customId = resource?.custom_id;
  const subscriptionId =
    eventType === "PAYMENT.SALE.COMPLETED"
      ? (resource as { billing_agreement_id?: string })?.billing_agreement_id
      : resource?.id;

  try {
    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
      if (customId && subscriptionId) {
        await prisma.user.update({
          where: { id: customId },
          data: { tier: "pro", paypalSubscriptionId: subscriptionId, subscriptionEndsAt: null },
        });
        const periodEnd = await getSubscriptionPeriodEnd(token, subscriptionId);
        if (periodEnd) {
          await prisma.user.update({
            where: { id: customId },
            data: { subscriptionEndsAt: periodEnd },
          });
        }
      }
    } else if (eventType === "PAYMENT.SALE.COMPLETED" && subscriptionId) {
      const periodEnd = await getSubscriptionPeriodEnd(token, subscriptionId);
      if (periodEnd) {
        const u = await prisma.user.findFirst({ where: { paypalSubscriptionId: subscriptionId } });
        if (u) {
          await prisma.user.update({
            where: { id: u.id },
            data: { subscriptionEndsAt: periodEnd },
          });
        }
      }
    } else if (
      eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
      eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
      eventType === "BILLING.SUBSCRIPTION.SUSPENDED"
    ) {
      let userId: string | null = customId ?? null;
      if (!userId && subscriptionId) {
        const u = await prisma.user.findFirst({ where: { paypalSubscriptionId: subscriptionId } });
        userId = u?.id ?? null;
      }
      if (userId) {
        const periodEnd = subscriptionId
          ? await getSubscriptionPeriodEnd(token, subscriptionId)
          : null;
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionEndsAt: periodEnd ?? undefined,
            paypalSubscriptionId: null,
          },
        });
      }
    }
  } catch (e) {
    console.error("PayPal webhook handler error:", e);
    res.status(500).send("Webhook handler failed");
    return;
  }

  res.sendStatus(200);
}
