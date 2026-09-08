import { describe, expect, it } from "vitest";
import {
  defaultPublicProfileLogView,
  normalizeLogView,
  parseStoredLogView,
} from "./logViewPreference";

describe("logViewPreference", () => {
  it("parses stored modes and legacy aliases", () => {
    expect(parseStoredLogView("grid")).toBe("grid");
    expect(parseStoredLogView("compact")).toBe("compact");
    expect(parseStoredLogView("dense")).toBe("compact");
    expect(parseStoredLogView("cards")).toBe("list");
    expect(parseStoredLogView(null)).toBeNull();
    expect(parseStoredLogView("nope")).toBeNull();
  });

  it("falls back to list when nothing valid is stored", () => {
    expect(normalizeLogView(null)).toBe("list");
  });

  it("defaults public profile to grid on mobile and list on desktop", () => {
    expect(defaultPublicProfileLogView(true)).toBe("grid");
    expect(defaultPublicProfileLogView(false)).toBe("list");
  });
});
