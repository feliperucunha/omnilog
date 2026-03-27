import { prisma } from "./prisma.js";

export const APP_SETTING_KEYS = {
  /** Body text for the beta welcome / announcement banner. */
  BETA_BANNER_MESSAGE: "beta_banner_message",
  /** ISO month `YYYY-MM` (UTC) of the last auto-sent monthly digest period (previous calendar month). */
  MONTHLY_DIGEST_LAST_SENT_PERIOD: "monthly_digest_last_sent_period",
} as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[keyof typeof APP_SETTING_KEYS];

const ALLOWED_SETTING_KEYS = new Set<string>(Object.values(APP_SETTING_KEYS));

export function isKnownAppSettingKey(key: string): key is AppSettingKey {
  return ALLOWED_SETTING_KEYS.has(key);
}

export async function getAppSettingValue(key: AppSettingKey): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return row?.value ?? null;
}

export async function upsertAppSettingValue(key: AppSettingKey, value: string) {
  return prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
    select: { key: true, value: true, updatedAt: true },
  });
}

