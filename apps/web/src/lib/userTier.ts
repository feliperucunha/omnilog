/** Matches GET /me `tier` (and Prisma `Tier`). */
export type MeTier = "free" | "beta" | "pro" | "admin";

/** Cosmetic Pro badge on reviews (pro / admin / beta). App features are not gated by this. */
export function tierHasProFeatures(tier: string | undefined): boolean {
  return tier === "pro" || tier === "admin" || tier === "beta";
}

/** Only paying Pro and admin: unlimited logs (free and beta keep the 500 cap). */
export function tierHasUnlimitedLogs(tier: string | undefined): boolean {
  return tier === "pro" || tier === "admin";
}
