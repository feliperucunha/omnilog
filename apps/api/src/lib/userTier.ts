import type { Tier } from "@prisma/client";

/** Pro, admin, and beta: export, statistics, profile customization, batch limits, etc. */
export function tierHasProFeatures(tier: Tier | string): boolean {
  return tier === "pro" || tier === "admin" || tier === "beta";
}

/** Only paying Pro and admin: unlimited logs (beta keeps the 500 cap). */
export function tierHasUnlimitedLogs(tier: Tier | string): boolean {
  return tier === "pro" || tier === "admin";
}
