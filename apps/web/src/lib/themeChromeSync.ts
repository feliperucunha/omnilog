/**
 * Browser / PWA chrome colors (address bar, etc.). Align with ThemeContext status bar on native.
 */
export const THEME_COLOR_LIGHT = "#f3efe7";
export const THEME_COLOR_DARK = "#10120f";

/** Updates the first `<meta name="theme-color">` to match the active app theme. No-op if missing. */
export function applyThemeColorMeta(doc: Document, scheme: "light" | "dark"): void {
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (!(meta instanceof HTMLMetaElement)) return;
  meta.content = scheme === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
}
