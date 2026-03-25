import { describe, it, expect, beforeEach } from "vitest";
import {
  applyThemeColorMeta,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
} from "./themeChromeSync";

describe("applyThemeColorMeta", () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#initial" />';
  });

  it("sets meta content for dark scheme", () => {
    applyThemeColorMeta(document, "dark");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      THEME_COLOR_DARK
    );
  });

  it("sets meta content for light scheme", () => {
    applyThemeColorMeta(document, "light");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      THEME_COLOR_LIGHT
    );
  });

  it("does not throw when theme-color meta is absent", () => {
    document.head.innerHTML = "";
    expect(() => applyThemeColorMeta(document, "dark")).not.toThrow();
  });

  it("updates the first matching meta when several exist", () => {
    document.head.innerHTML =
      '<meta name="theme-color" content="#first" /><meta name="theme-color" content="#second" />';
    applyThemeColorMeta(document, "light");
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    expect(metas[0]?.getAttribute("content")).toBe(THEME_COLOR_LIGHT);
    expect(metas[1]?.getAttribute("content")).toBe("#second");
  });
});
