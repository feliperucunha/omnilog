import type { MeResponse } from "@/contexts/MeContext";

/** When true, skip client-side API-key prompts/banners (server must also allow via feature flag). */
export const isDisableApiKeyRequirements = (me: MeResponse | null): boolean =>
  me?.featureFlags?.disableApiKeyRequirements === true;
