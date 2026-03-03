/**
 * PayPal hosted subscription buttons (PayPal-hosted button IDs).
 * Add entries here for each (country, interval) combo. Key format: "country|interval".
 * - country: "default" (non-BR) or "BR"
 * - interval: "monthly" | "yearly"
 */

export type BillingInterval = "monthly" | "yearly";

export interface PayPalHostedButton {
  hostedButtonId: string;
  currencyCode: string;
  /** Optional: override subscribe button image (e.g. pt_BR for Brazil). */
  imageUrl?: string;
}

const SUBSCRIBE_IMAGE_PT_BR = "https://www.paypalobjects.com/pt_BR/i/btn/btn_subscribe_LG.gif";

/** Map: "default|monthly" | "default|yearly" | "BR|monthly" | "BR|yearly" -> config */
const HOSTED_BUTTONS: Record<string, PayPalHostedButton> = {
  "default|monthly": {
    hostedButtonId: "UC8JAPLS9NWDE",
    currencyCode: "USD",
  },
  "BR|monthly": {
    hostedButtonId: "LB4JPT29LJWGE",
    currencyCode: "BRL",
    imageUrl: SUBSCRIBE_IMAGE_PT_BR,
  },
  // Add more as needed, e.g.:
  // "default|yearly": { hostedButtonId: "...", currencyCode: "USD" },
  // "BR|yearly": { hostedButtonId: "...", currencyCode: "BRL" },
};

const PAYPAL_WEBSCR = "https://www.paypal.com/cgi-bin/webscr";

function configKey(country: string | undefined, interval: BillingInterval): string {
  const region = country === "BR" ? "BR" : "default";
  return `${region}|${interval}`;
}

/**
 * Returns the hosted button config for the given country and interval, or undefined if none.
 */
export function getPayPalHostedButton(
  country: string | undefined,
  interval: BillingInterval
): PayPalHostedButton | undefined {
  return HOSTED_BUTTONS[configKey(country, interval)];
}

/**
 * PayPal webscr URL for hosted subscription buttons (for form action).
 */
export const PAYPAL_HOSTED_FORM_ACTION = PAYPAL_WEBSCR;
