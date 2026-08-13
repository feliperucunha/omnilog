import { describe, expect, it } from "vitest";
import {
  androidHeroVerticalBounds,
  classifyImageAspectRatio,
  logCompleteAndroidHeroImgClass,
  logCompleteHeroFrameStyle,
  logCompleteHeroWrapperClass,
  logCompletePrioritizeTextSpace,
  buildLogCompleteShareLayout,
  logCompleteShareHeroShrinkForText,
  logCompleteShareTextLimits,
  logCompleteUsesContainBackdrop,
  resolveLogCompleteHeroLayout,
} from "./logCompleteHeroLayout";

describe("classifyImageAspectRatio", () => {
  it("classifies portrait posters", () => {
    expect(classifyImageAspectRatio(600, 900)).toBe("portrait");
  });

  it("classifies square art", () => {
    expect(classifyImageAspectRatio(500, 500)).toBe("square");
  });

  it("classifies landscape box art", () => {
    expect(classifyImageAspectRatio(900, 600)).toBe("landscape");
  });
});

describe("resolveLogCompleteHeroLayout", () => {
  it("defaults to landscape for assumed BGG before load", () => {
    expect(resolveLogCompleteHeroLayout(null, true)).toBe("landscape");
  });

  it("defaults to portrait before load for other media", () => {
    expect(resolveLogCompleteHeroLayout(null, false)).toBe("portrait");
  });

  it("uses measured dimensions when available", () => {
    expect(resolveLogCompleteHeroLayout({ width: 400, height: 400 }, false)).toBe("square");
  });
});

describe("logCompleteUsesContainBackdrop", () => {
  it("uses contain for square and landscape on web only", () => {
    expect(logCompleteUsesContainBackdrop("portrait")).toBe(false);
    expect(logCompleteUsesContainBackdrop("square")).toBe(true);
    expect(logCompleteUsesContainBackdrop("landscape")).toBe(true);
    expect(logCompleteUsesContainBackdrop("square", true)).toBe(false);
    expect(logCompleteUsesContainBackdrop("landscape", true)).toBe(false);
  });
});

describe("logCompleteHeroFrameStyle", () => {
  it("returns intrinsic aspect on Android when natural size is known", () => {
    expect(
      logCompleteHeroFrameStyle({
        natural: { width: 800, height: 600 },
        layout: "landscape",
        androidWebView: true,
      })
    ).toEqual({
      width: "100%",
      aspectRatio: "800 / 600",
      maxHeight: "min(36dvh, 300px)",
      minHeight: "min(22dvh, 180px)",
    });
  });

  it("uses full-width height slot for portrait (no aspect-ratio shrink)", () => {
    expect(
      logCompleteHeroFrameStyle({
        natural: { width: 600, height: 900 },
        layout: "portrait",
        androidWebView: true,
      })
    ).toEqual({
      width: "100%",
      height: "min(62dvh, 560px)",
      minHeight: "min(42dvh, 380px)",
    });
    expect(logCompleteHeroFrameStyle({
      natural: { width: 600, height: 900 },
      layout: "portrait",
      androidWebView: true,
    })).not.toHaveProperty("aspectRatio");
  });

  it("allocates more vertical space for portrait than square", () => {
    const portrait = androidHeroVerticalBounds("portrait");
    const square = androidHeroVerticalBounds("square");
    const landscape = androidHeroVerticalBounds("landscape");
    expect(portrait.maxHeight).toContain("560");
    expect(square.maxHeight).toContain("460");
    expect(landscape.maxHeight).toContain("300");
    expect(portrait.maxHeight).not.toBe(square.maxHeight);
  });

  it("returns undefined on web", () => {
    expect(
      logCompleteHeroFrameStyle({
        natural: { width: 800, height: 600 },
        layout: "landscape",
        androidWebView: false,
      })
    ).toBeUndefined();
  });

  it("uses preset aspect before natural size loads for square", () => {
    expect(
      logCompleteHeroFrameStyle({
        natural: null,
        layout: "square",
        androidWebView: true,
      })?.aspectRatio
    ).toBe("1 / 1");
  });
});

describe("logCompleteShareTextLimits", () => {
  it("allows more title and review lines than the old share defaults", () => {
    const limits = logCompleteShareTextLimits("A solid watch with great pacing.", "Short title");
    expect(limits.titleLineClamp).toBeGreaterThanOrEqual(3);
    expect(limits.reviewLineClamp).toBeGreaterThan(3);
  });

  it("expands review clamp for long copy and caps at 15", () => {
    const limits = logCompleteShareTextLimits("a".repeat(400), "Title");
    expect(limits.reviewLineClamp).toBe(15);
    expect(limits.titleLineClamp).toBeLessThanOrEqual(3);
  });
});

describe("logCompleteShareHeroShrinkForText", () => {
  it("reclaims hero height when text is prioritized", () => {
    expect(logCompleteShareHeroShrinkForText(408, true, "portrait")).toBeGreaterThan(0);
    expect(logCompleteShareHeroShrinkForText(408, false, "portrait")).toBe(0);
  });
});

describe("buildLogCompleteShareLayout", () => {
  it("uses a taller portrait hero than the legacy 348px baseline", () => {
    const layout = buildLogCompleteShareLayout({
      heroLayout: "portrait",
      compactShareLayout: true,
      prioritizeText: false,
    });
    expect(layout.heroH).toBeGreaterThan(348);
  });

  it("keeps portrait hero taller than square", () => {
    const portrait = buildLogCompleteShareLayout({
      heroLayout: "portrait",
      compactShareLayout: true,
      prioritizeText: false,
    });
    const square = buildLogCompleteShareLayout({
      heroLayout: "square",
      compactShareLayout: true,
      prioritizeText: false,
    });
    expect(portrait.heroH).toBeGreaterThan(square.heroH);
  });

  it("matches square hero height to card width (no letterbox banding)", () => {
    const square = buildLogCompleteShareLayout({
      heroLayout: "square",
      compactShareLayout: true,
      prioritizeText: false,
      natural: { width: 500, height: 500 },
    });
    expect(square.heroH).toBe(288);
    expect(square.cardW).toBe(288);
  });

  it("sizes hero from natural aspect for portrait", () => {
    const layout = buildLogCompleteShareLayout({
      heroLayout: "portrait",
      compactShareLayout: true,
      prioritizeText: false,
      natural: { width: 600, height: 900 },
    });
    expect(layout.heroH).toBe(Math.round(288 * (900 / 600)));
  });
});

describe("logCompleteAndroidHeroImgClass", () => {
  it("covers portrait and square, contains landscape", () => {
    expect(logCompleteAndroidHeroImgClass("portrait")).toContain("object-cover");
    expect(logCompleteAndroidHeroImgClass("square")).toContain("object-cover");
    expect(logCompleteAndroidHeroImgClass("landscape")).toContain("object-contain");
  });
});

describe("logCompleteHeroWrapperClass android", () => {
  it("uses a simple full-width wrapper (sizes via inline frame style)", () => {
    const cls = logCompleteHeroWrapperClass({
      layout: "square",
      androidWebView: true,
    });
    expect(cls).not.toContain("aspect-square");
    expect(cls).toContain("w-full");
  });
});

describe("logCompletePrioritizeTextSpace", () => {
  it("detects long review or title", () => {
    expect(logCompletePrioritizeTextSpace("a".repeat(100), "Short")).toBe(true);
    expect(logCompletePrioritizeTextSpace("", "A".repeat(60))).toBe(true);
    expect(logCompletePrioritizeTextSpace("Brief", "Short title")).toBe(false);
  });
});

describe("logCompleteHeroWrapperClass compactForText", () => {
  it("shrinks android portrait hero when text needs room", () => {
    const normal = logCompleteHeroFrameStyle({
      natural: null,
      layout: "portrait",
      androidWebView: true,
    });
    const compact = logCompleteHeroFrameStyle({
      natural: null,
      layout: "portrait",
      androidWebView: true,
      compactForText: true,
    });
    expect(normal?.height).toContain("62dvh");
    expect(compact?.height).toContain("48dvh");
    expect(compact?.height).not.toBe(normal?.height);
  });
});
