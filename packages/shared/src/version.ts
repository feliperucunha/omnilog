/**
 * Single source of truth for app version (frontend + API). The repo pre-commit hook
 * bumps the patch on each commit. Native clients may show an optional update prompt when
 * the deployed API reports a newer version via /api/health.
 */
export const APP_VERSION = "1.0.23";
