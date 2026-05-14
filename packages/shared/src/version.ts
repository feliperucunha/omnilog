/**
 * Single source of truth for app version (frontend + API). The repo pre-commit hook
 * bumps the patch on each commit so native builds drift visibly from the deployed API.
 * Mismatch triggers an update warning on native and 401 from the API unless the admin
 * flag “Ignore native app version gate” is enabled.
 */
export const APP_VERSION = "1.0.4";
