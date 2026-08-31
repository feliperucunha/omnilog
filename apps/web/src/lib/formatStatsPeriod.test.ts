import { describe, expect, it } from "vitest";
import {
  currentStatsPeriodKey,
  partitionStatsPeriods,
  sortStatsPeriodsDesc,
  statsPeriodRecentCutoff,
} from "./formatStatsPeriod";

describe("sortStatsPeriodsDesc", () => {
  it("sorts YYYY-MM keys newest first", () => {
    expect(sortStatsPeriodsDesc(["2024-01", "2026-07", "2025-12"])).toEqual([
      "2026-07",
      "2025-12",
      "2024-01",
    ]);
  });
});

describe("currentStatsPeriodKey", () => {
  it("matches the latest cutoff (keep 1)", () => {
    const tz = -180;
    expect(currentStatsPeriodKey("month", tz)).toBe(statsPeriodRecentCutoff("month", tz, 1));
    expect(currentStatsPeriodKey("year", tz)).toBe(statsPeriodRecentCutoff("year", tz, 1));
  });
});

describe("partitionStatsPeriods", () => {
  it("keeps the three most recent months by default", () => {
    const tz = 0;
    const cutoff = statsPeriodRecentCutoff("month", tz);
    const periods = ["2020-01", cutoff, "2099-12"];
    const { recent, older } = partitionStatsPeriods(periods, "month", tz);
    expect(recent).toContain(cutoff);
    expect(recent).toContain("2099-12");
    expect(older).toContain("2020-01");
    expect(recent.length).toBeLessThanOrEqual(3);
  });
});
