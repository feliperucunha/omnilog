/**
 * Single source of truth for app version (frontend + API). The repo pre-commit hook
 * bumps the patch on each commit. Shown in /api/health and the optional native update
 * prompt only — API access is not gated on this value unless ENFORCE_APP_VERSION_GATE=true.
 */
export const APP_VERSION = "1.0.40";
