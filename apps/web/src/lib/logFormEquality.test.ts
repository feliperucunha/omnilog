import { describe, expect, it } from "vitest";
import {
  episodeFieldUnchanged,
  episodePayloadValue,
  gradeStarsUnchanged,
  logDateInputMatchesStored,
} from "./logFormEquality";

describe("logFormEquality", () => {
  it("detects unchanged grade stars", () => {
    expect(gradeStarsUnchanged(4, 8)).toBe(true);
    expect(gradeStarsUnchanged(3, 8)).toBe(false);
  });

  it("matches calendar day for started/completed inputs", () => {
    expect(logDateInputMatchesStored("2024-06-15T12:00:00.000Z", "2024-06-15")).toBe(true);
    expect(logDateInputMatchesStored("2024-06-15T12:00:00.000Z", "2024-06-16")).toBe(false);
    expect(logDateInputMatchesStored(null, "")).toBe(true);
  });

  it("uses form episode value when not auto-completing", () => {
    expect(episodePayloadValue(5, "watching", 24, true)).toBe(5);
    expect(episodePayloadValue("", "completed", 24, true)).toBe(24);
    expect(episodePayloadValue(3, "completed", null, true)).toBe(3);
  });

  it("detects unchanged episode field", () => {
    expect(episodeFieldUnchanged("", null)).toBe(true);
    expect(episodeFieldUnchanged(10, 10)).toBe(true);
    expect(episodeFieldUnchanged(9, 10)).toBe(false);
  });
});
