import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRecapTitle, recapBoundsForDays, recapCheckpointDays } from "./recapPeriodBounds";

afterEach(() => {
  vi.useRealTimers();
});

describe("recap time range", () => {
  it("bounds a 365-day range to local midnights", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T15:00:00.000Z"));
    const { from, to } = recapBoundsForDays(365, 0);
    expect(from.toISOString()).toBe("2025-11-27T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-27T15:00:00.000Z");
  });

  it("exposes last-week, last-month, and Jan 1 checkpoints inside the year bar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T15:00:00.000Z"));
    expect(recapCheckpointDays(0)).toEqual([
      { days: 330, kind: "jan1" },
      { days: 30, kind: "lastMonth" },
      { days: 7, kind: "lastWeek" },
    ]);
  });

  it("builds titles for both slider and all-time recaps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T15:00:00.000Z"));
    const base = {
      categoryLabel: "All media",
      locale: "en",
      tzOffsetMinutes: 0,
      allTimeLabel: "All time",
      sinceLabel: "Since",
    };
    expect(buildRecapTitle({ ...base, daysAgo: 30, allTime: false })).toBe(
      "All media — Since Oct 28, 2026"
    );
    expect(buildRecapTitle({ ...base, daysAgo: 365, allTime: true })).toBe(
      "All media — All time"
    );
  });
});
