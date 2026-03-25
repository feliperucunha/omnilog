/** Matches GET /me `tier` (and Prisma `Tier`). */
export type MeTier = "free" | "beta" | "pro" | "admin";

export function tierHasProFeatures(tier: string | undefined): boolean {
  return tier === "pro" || tier === "admin" || tier === "beta";
}

export function tierHasUnlimitedLogs(tier: string | undefined): boolean {
  return tier === "pro" || tier === "admin";
}
