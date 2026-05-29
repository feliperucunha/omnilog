export function navItemIsActive(to: string, pathname: string): boolean {
  if (to === "/") return pathname === "/" || pathname === "/search";
  return pathname === to;
}

export function getMainNavTransitionKey(pathname: string): string {
  if (pathname === "/" || pathname === "/search") return "nav-search";
  if (pathname.startsWith("/dashboard")) return "nav-dashboard";
  if (pathname.startsWith("/statistics")) return "nav-statistics";
  if (pathname.startsWith("/settings")) return "nav-settings";
  if (pathname.startsWith("/tiers")) return "nav-tiers";
  return pathname;
}
