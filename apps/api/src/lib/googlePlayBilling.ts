import { google } from "googleapis";
import { prisma } from "./prisma.js";

export type GooglePlayVerifyOutcome = {
  entitled: boolean;
  expiry: Date | null;
  productId: string | null;
  /** All product IDs on the subscription purchase (for validating client-reported productId). */
  lineItemProductIds: string[];
  subscriptionState: string | null;
  needsAcknowledgement: boolean;
};

function getPublisherClient():
  | { androidPublisher: ReturnType<typeof google.androidpublisher>; packageName: string }
  | null {
  const json = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  const packageName =
    process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() || "com.geeklogs.app";
  if (!json) return null;
  try {
    const credentials = JSON.parse(json) as Record<string, unknown>;
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const androidPublisher = google.androidpublisher({ version: "v3", auth });
    return { androidPublisher, packageName };
  } catch (e) {
    console.error("Google Play billing: invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", e);
    return null;
  }
}

export function isGooglePlayBillingConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim());
}

export function getExpectedGooglePlayProductIds(): { monthly: string | null; yearly: string | null } {
  return {
    monthly: process.env.GOOGLE_PLAY_SUBSCRIPTION_ID_MONTHLY?.trim() ?? null,
    yearly: process.env.GOOGLE_PLAY_SUBSCRIPTION_ID_YEARLY?.trim() ?? null,
  };
}

function maxExpiryFromLineItems(
  lineItems: Array<{ expiryTime?: string | null }> | null | undefined
): Date | null {
  if (!lineItems?.length) return null;
  let max: Date | null = null;
  for (const li of lineItems) {
    if (!li.expiryTime) continue;
    const d = new Date(li.expiryTime);
    if (Number.isNaN(d.getTime())) continue;
    if (!max || d > max) max = d;
  }
  return max;
}

/**
 * True if the user should have Pro access from this Google Play subscription state.
 */
function subscriptionEntitled(
  state: string | null | undefined,
  expiry: Date | null
): boolean {
  if (!expiry || expiry.getTime() <= Date.now()) return false;
  if (state === "SUBSCRIPTION_STATE_EXPIRED" || state === "SUBSCRIPTION_STATE_REVOKED")
    return false;
  if (state === "SUBSCRIPTION_STATE_PENDING" || state === "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED")
    return false;
  if (state === "SUBSCRIPTION_STATE_PAUSED") return false;
  return true;
}

/**
 * Verify a subscription purchase token with Google and optionally acknowledge it.
 */
export async function verifyGooglePlayPurchase(
  purchaseToken: string,
  options?: { acknowledge?: boolean }
): Promise<GooglePlayVerifyOutcome | null> {
  const client = getPublisherClient();
  if (!client) return null;

  const { androidPublisher, packageName } = client;
  const { data } = await androidPublisher.purchases.subscriptionsv2.get({
    packageName,
    token: purchaseToken,
  });

  const subscriptionState = data.subscriptionState ?? null;
  const rawItems = data.lineItems ?? [];
  const lineItemProductIds = rawItems
    .map((li) => li.productId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const expiry = maxExpiryFromLineItems(rawItems);
  const productId = lineItemProductIds[0] ?? null;
  const entitled = subscriptionEntitled(subscriptionState, expiry);
  const needsAcknowledgement =
    data.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING";

  if (options?.acknowledge && needsAcknowledgement && productId && entitled) {
    try {
      await androidPublisher.purchases.subscriptions.acknowledge({
        packageName,
        subscriptionId: productId,
        token: purchaseToken,
      });
    } catch (e) {
      console.error("Google Play acknowledge failed:", e);
    }
  }

  return {
    entitled,
    expiry,
    productId,
    lineItemProductIds,
    subscriptionState,
    needsAcknowledgement,
  };
}

export function isAllowedGooglePlayProductId(productId: string): boolean {
  const { monthly, yearly } = getExpectedGooglePlayProductIds();
  const allowed = [monthly, yearly].filter(Boolean) as string[];
  if (allowed.length === 0) return false;
  return allowed.includes(productId);
}

/**
 * Refresh all stored Play subscriptions against Google; downgrade expired; update expiry dates.
 * Skips admin users. Returns count of users whose tier was cleared or token removed.
 */
export async function syncGooglePlaySubscriptions(): Promise<number> {
  if (!isGooglePlayBillingConfigured()) return 0;

  const users = await prisma.user.findMany({
    where: { googlePlayPurchaseToken: { not: null } },
    select: { id: true, tier: true, googlePlayPurchaseToken: true },
  });

  let cleared = 0;
  for (const u of users) {
    if (u.tier === "admin") continue;
    const token = u.googlePlayPurchaseToken!;
    try {
      const outcome = await verifyGooglePlayPurchase(token, { acknowledge: true });
      if (!outcome?.entitled) {
        await prisma.user.update({
          where: { id: u.id },
          data: {
            googlePlayPurchaseToken: null,
            googlePlayProductId: null,
            subscriptionEndsAt: null,
            ...(u.tier === "pro" ? { tier: "free" as const } : {}),
          },
        });
        cleared++;
      } else {
        await prisma.user.update({
          where: { id: u.id },
          data: {
            subscriptionEndsAt: outcome.expiry ?? undefined,
            ...(outcome.productId ? { googlePlayProductId: outcome.productId } : {}),
          },
        });
      }
    } catch (e) {
      console.error(`Google Play sync failed for user ${u.id}:`, e);
    }
  }
  return cleared;
}

export type GooglePlayPurchaseTokenApplyResult =
  | "updated"
  | "cleared"
  | "not_found"
  | "skipped"
  | "not_configured";

/**
 * Refresh entitlement for the user linked to this purchase token (RTDN / targeted sync).
 * Calls subscriptionsv2 + acknowledge when appropriate.
 */
export async function applyGooglePlaySubscriptionUpdateForPurchaseToken(
  purchaseToken: string
): Promise<GooglePlayPurchaseTokenApplyResult> {
  if (!isGooglePlayBillingConfigured()) return "not_configured";

  const user = await prisma.user.findFirst({
    where: { googlePlayPurchaseToken: purchaseToken },
    select: { id: true, tier: true },
  });
  if (!user) return "not_found";
  if (user.tier === "admin") return "skipped";

  let outcome;
  try {
    outcome = await verifyGooglePlayPurchase(purchaseToken, { acknowledge: true });
  } catch (e) {
    console.error("Google Play RTDN verify failed:", e);
    throw e;
  }

  if (!outcome?.entitled) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googlePlayPurchaseToken: null,
        googlePlayProductId: null,
        subscriptionEndsAt: null,
        ...(user.tier === "pro" ? { tier: "free" as const } : {}),
      },
    });
    return "cleared";
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      tier: "pro" as const,
      subscriptionEndsAt: outcome.expiry ?? undefined,
      ...(outcome.productId ? { googlePlayProductId: outcome.productId } : {}),
    },
  });
  return "updated";
}

/**
 * Revoke local entitlement when Google voids a subscription purchase (refund / chargeback).
 */
export async function revokeGooglePlayEntitlementForPurchaseToken(
  purchaseToken: string
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { googlePlayPurchaseToken: purchaseToken },
    select: { id: true, tier: true },
  });
  if (!user) return false;
  if (user.tier === "admin") return false;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      googlePlayPurchaseToken: null,
      googlePlayProductId: null,
      subscriptionEndsAt: null,
      ...(user.tier === "pro" ? { tier: "free" as const } : {}),
    },
  });
  return true;
}
