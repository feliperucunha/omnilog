/**
 * Single source of truth for app version. Bump this when deploying;
 * frontend and API must stay in sync. Mismatch triggers update modal on mobile
 * and 401 from API for all requests.
 */
export const APP_VERSION = "1.0.0";
