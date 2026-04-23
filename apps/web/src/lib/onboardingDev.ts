/**
 * Set `VITE_FORCE_ONBOARDING=true` in `.env.local` (rebuild dev server).
 * While you are already onboarded, the onboarding flow opens in a modal on top of the app
 * so you can test UI without a fresh account.
 */
export const FORCE_ONBOARDING_UI = import.meta.env.VITE_FORCE_ONBOARDING === "true";
