/**
 * Public website origin (Stripe checkout, login). Defaults to production geeklogs.com.br.
 * Override with VITE_APP_WEB_ORIGIN for dev/staging.
 */
const DEFAULT_PUBLIC_WEB_ORIGIN = "https://geeklogs.com.br";

export function getPublicWebOrigin(): string {
  const e = import.meta.env.VITE_APP_WEB_ORIGIN?.trim();
  return e && e.length > 0 ? e : DEFAULT_PUBLIC_WEB_ORIGIN;
}

/**
 * `https://…/login?from=/path` — use for native app handoff so users sign in on the site, then we navigate to `from`.
 */
export function buildWebLoginUrlWithFromPath(pathWithQuery: string): string {
  const p = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  const base = getPublicWebOrigin().replace(/\/$/, "");
  const u = new URL("/login", `${base}/`);
  u.searchParams.set("from", p);
  return u.toString();
}

export function buildNativeProCheckoutUrl(interval: "monthly" | "yearly"): string {
  return buildWebLoginUrlWithFromPath(`/tiers?interval=${interval}`);
}
