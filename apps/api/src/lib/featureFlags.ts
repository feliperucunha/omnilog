import { prisma } from "./prisma.js";

/** Known keys; admin may only update these. */
export const FEATURE_FLAG_KEYS = {
  DISABLE_API_KEY_REQUIREMENTS: "disable_api_key_requirements",
  /** When enabled, POST /auth/register assigns tier `beta` instead of `free`. */
  REGISTER_NEW_USERS_AS_BETA: "register_new_users_as_beta",
  /** When enabled, show the beta welcome / announcement banner to beta users (client-side dismissal persists per message). */
  BETA_BANNER_ENABLED: "beta_banner_enabled",
  /**
   * When enabled, the web app periodically requests /api/health to reduce cold starts on free hosts
   * that sleep after idle (e.g. Koyeb). API env WAKE_API_PING_ENABLED=true also turns this on without DB.
   * Temporary ops toggle; remove when on a paid always-on plan.
   */
  WAKE_API_PING: "wake_api_ping",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

const ALLOWED_KEYS = new Set<string>(Object.values(FEATURE_FLAG_KEYS));

export function isKnownFeatureFlagKey(key: string): key is FeatureFlagKey {
  return ALLOWED_KEYS.has(key);
}

export async function isDisableApiKeyRequirementsEnabled(): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({
    where: { key: FEATURE_FLAG_KEYS.DISABLE_API_KEY_REQUIREMENTS },
    select: { enabled: true },
  });
  // No row (pre-migration DB): default relaxed UX. Row present: honor explicit enabled value.
  if (row == null) return true;
  return row.enabled;
}

/** New registrations use tier `beta` when true, `free` when false or flag row missing. */
export async function isRegisterNewUsersAsBetaEnabled(): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({
    where: { key: FEATURE_FLAG_KEYS.REGISTER_NEW_USERS_AS_BETA },
    select: { enabled: true },
  });
  if (row == null) return false;
  return row.enabled;
}

/** Default: show (row missing) so existing behavior remains until admin disables. */
export async function isBetaBannerEnabled(): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({
    where: { key: FEATURE_FLAG_KEYS.BETA_BANNER_ENABLED },
    select: { enabled: true },
  });
  if (row == null) return true;
  return row.enabled;
}

/** Default off — enable in admin when using a sleep-prone free API tier. */
export async function isWakeApiPingEnabled(): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({
    where: { key: FEATURE_FLAG_KEYS.WAKE_API_PING },
    select: { enabled: true },
  });
  if (row == null) return false;
  return row.enabled;
}

/** When no DB row exists, admin list and toggles use these defaults (same as the `is*` readers). */
function defaultEnabledWhenMissing(key: FeatureFlagKey): boolean {
  switch (key) {
    case FEATURE_FLAG_KEYS.DISABLE_API_KEY_REQUIREMENTS:
      return true;
    case FEATURE_FLAG_KEYS.REGISTER_NEW_USERS_AS_BETA:
      return false;
    case FEATURE_FLAG_KEYS.BETA_BANNER_ENABLED:
      return true;
    case FEATURE_FLAG_KEYS.WAKE_API_PING:
      return false;
    default:
      return false;
  }
}

/** All known keys for admin UI, merged with DB (missing rows show effective defaults). */
export async function listFeatureFlags() {
  const rows = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
    select: { key: true, enabled: true, updatedAt: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const keys = (Object.values(FEATURE_FLAG_KEYS) as FeatureFlagKey[]).sort((a, b) =>
    a.localeCompare(b)
  );
  return keys.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      enabled: row ? row.enabled : defaultEnabledWhenMissing(key),
      updatedAt: row?.updatedAt ?? new Date(0),
    };
  });
}

export async function setFeatureFlagEnabled(key: FeatureFlagKey, enabled: boolean) {
  return prisma.featureFlag.upsert({
    where: { key },
    create: { key, enabled },
    update: { enabled },
    select: { key: true, enabled: true, updatedAt: true },
  });
}
