import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma.js";
import {
  applyGooglePlaySubscriptionUpdateForPurchaseToken,
  isAllowedGooglePlayProductId,
  revokeGooglePlayEntitlementForPurchaseToken,
} from "../lib/googlePlayBilling.js";

/** Cloud Pub/Sub push JSON body. */
interface PubSubPushBody {
  message?: {
    data?: string;
    messageId?: string;
    attributes?: Record<string, string>;
  };
  subscription?: string;
}

/** Decoded Play RTDN payload (DeveloperNotification). */
interface DeveloperNotification {
  version?: string;
  packageName?: string;
  eventTimeMillis?: string | number;
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    /** Present in some payloads; optional per Google docs revisions. */
    subscriptionId?: string;
  };
  voidedPurchaseNotification?: {
    purchaseToken?: string;
    orderId?: string;
    productType?: number;
    refundType?: number;
  };
  testNotification?: { version?: string };
  oneTimeProductNotification?: unknown;
}

function isPubSubPushConfigured(): boolean {
  return (
    Boolean(process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE?.trim()) ||
    Boolean(process.env.GOOGLE_PLAY_PUBSUB_PUSH_SECRET?.trim()) ||
    (process.env.NODE_ENV !== "production" &&
      process.env.GOOGLE_PLAY_PUBSUB_ALLOW_UNAUTHENTICATED === "true")
  );
}

async function verifyPubSubPushRequest(req: Request): Promise<boolean> {
  const audience = process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE?.trim();
  const secret = process.env.GOOGLE_PLAY_PUBSUB_PUSH_SECRET?.trim();

  if (audience) {
    const auth = req.headers.authorization;
    if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return false;
    const token = auth.slice(7);
    try {
      const client = new OAuth2Client();
      const ticket = await client.verifyIdToken({ idToken: token, audience });
      return ticket.getPayload() != null;
    } catch {
      return false;
    }
  }

  if (secret) {
    const header = req.headers["x-geeklogs-pubsub-secret"];
    return typeof header === "string" && header === secret;
  }

  return (
    process.env.NODE_ENV !== "production" &&
    process.env.GOOGLE_PLAY_PUBSUB_ALLOW_UNAUTHENTICATED === "true"
  );
}

/**
 * POST /api/billing/google-play/pubsub
 * Google Cloud Pub/Sub push delivery for Play Real-time developer notifications.
 * Must be registered without X-App-Version and with relaxed rate limits.
 */
export async function handleGooglePlayPubSubPush(req: Request, res: Response): Promise<void> {
  if (!isPubSubPushConfigured()) {
    res.status(503).json({
      error:
        "RTDN push is not configured. Set GOOGLE_PLAY_PUBSUB_AUDIENCE (JWT) and/or GOOGLE_PLAY_PUBSUB_PUSH_SECRET.",
    });
    return;
  }

  const authed = await verifyPubSubPushRequest(req);
  if (!authed) {
    res.status(403).send("Forbidden");
    return;
  }

  const body = req.body as PubSubPushBody;
  const messageId = body.message?.messageId;
  if (!messageId || typeof messageId !== "string") {
    res.status(400).send("Bad Request");
    return;
  }

  try {
    await prisma.googlePlayPubSubMessage.create({
      data: { messageId },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      res.sendStatus(204);
      return;
    }
    console.error("Google Play Pub/Sub idempotency claim failed:", e);
    res.status(500).send("Internal Error");
    return;
  }

  const releaseClaim = () =>
    prisma.googlePlayPubSubMessage.delete({ where: { messageId } }).catch(() => {
      /* best-effort for retry */
    });

  try {
    const raw = body.message?.data;
    if (!raw || typeof raw !== "string") {
      res.sendStatus(204);
      return;
    }

    let decoded: string;
    try {
      decoded = Buffer.from(raw, "base64").toString("utf8");
    } catch {
      res.sendStatus(204);
      return;
    }

    let notification: DeveloperNotification;
    try {
      notification = JSON.parse(decoded) as DeveloperNotification;
    } catch {
      res.sendStatus(204);
      return;
    }

    const expectedPackage =
      process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() || "com.geeklogs.app";
    if (
      notification.packageName &&
      notification.packageName.length > 0 &&
      notification.packageName !== expectedPackage
    ) {
      res.sendStatus(204);
      return;
    }

    if (notification.testNotification) {
      console.log(
        JSON.stringify({ type: "play_rtdn_test", messageId, packageName: notification.packageName })
      );
      res.sendStatus(204);
      return;
    }

    const voided = notification.voidedPurchaseNotification;
    if (voided?.purchaseToken) {
      // 2 = one-time product; Geeklogs Pro is subscription-only — ignore one-time voids.
      if (voided.productType !== 2) {
        const revoked = await revokeGooglePlayEntitlementForPurchaseToken(voided.purchaseToken);
        console.log(
          JSON.stringify({
            type: "play_rtdn_voided",
            messageId,
            productType: voided.productType,
            revoked,
          })
        );
      }
      res.sendStatus(204);
      return;
    }

    const sub = notification.subscriptionNotification;
    if (sub?.purchaseToken) {
      const sid = sub.subscriptionId;
      if (sid && !isAllowedGooglePlayProductId(sid)) {
        console.log(
          JSON.stringify({ type: "play_rtdn_ignored_sku", messageId, subscriptionId: sid })
        );
        res.sendStatus(204);
        return;
      }

      const result = await applyGooglePlaySubscriptionUpdateForPurchaseToken(sub.purchaseToken);
      console.log(
        JSON.stringify({
          type: "play_rtdn_subscription",
          messageId,
          notificationType: sub.notificationType,
          result,
        })
      );
      res.sendStatus(204);
      return;
    }

    res.sendStatus(204);
  } catch (err) {
    console.error("Google Play Pub/Sub handler error:", err);
    await releaseClaim();
    res.status(500).send("Internal Error");
  }
}
