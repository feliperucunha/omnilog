import { registerPlugin } from "@capacitor/core";

export interface PlayBillingProductRow {
  productId: string;
  offerToken?: string;
}

export interface PlayBillingPlugin {
  querySubscriptionProducts(options: {
    productIds: string[];
  }): Promise<{ products: PlayBillingProductRow[] }>;
  purchaseSubscription(options: {
    productId: string;
    offerToken: string;
    obfuscatedAccountId?: string;
  }): Promise<{ purchaseToken: string; products: string[] }>;
  openPlayStoreListing(options?: { packageId?: string }): Promise<void>;
}

/** Android-only Capacitor plugin; no-op registration on web (calls will fail at runtime if invoked). */
export const PlayBilling = registerPlugin<PlayBillingPlugin>("PlayBilling");

/** True when the user dismissed the Google Play purchase sheet (standard BillingClient USER_CANCELED). */
export function isNativePurchaseUserCanceled(err: unknown): boolean {
  if (err == null) return false;
  if (typeof err === "object" && err !== null && "code" in err) {
    const c = (err as { code?: unknown }).code;
    if (c === "USER_CANCELED") return true;
  }
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" &&
          err !== null &&
          "message" in err &&
          typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : String(err);
  return msg.includes("USER_CANCELED");
}
