import type { MeResponse } from "@/contexts/MeContext";

/** When true, skip client-side API-key prompts/banners (server must also allow via feature flag). */
export const isDisableApiKeyRequirements = (me: MeResponse | null): boolean =>
  me?.featureFlags?.disableApiKeyRequirements === true;

/**
 * Hide missing-key banners/prompts when the server flag is on, or while /me is still loading for a
 * logged-in user (so we never flash warnings before `featureFlags` is known). Guests use normal UX.
 */
export const skipApiKeyMissingUi = (
  me: MeResponse | null,
  opts: { token: boolean; meLoading: boolean }
): boolean => {
  if (isDisableApiKeyRequirements(me)) return true;
  if (opts.token && opts.meLoading && me == null) return true;
  return false;
};
