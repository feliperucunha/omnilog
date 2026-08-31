import { describe, expect, it } from "vitest";
import {
  binBoardGameWeight,
  boardGameWeightHistogramEntries,
  boardGameWeightScopeWhere,
  parseBoardGameWeightBin,
  parseBoardGameWeightScope,
  sumMetricByPeriod,
} from "./statsCategoryMetrics.js";

describe("binBoardGameWeight", () => {
  it("rounds to nearest 0.5 and clamps to 0.5–5", () => {
    expect(binBoardGameWeight(1.2)).toBe(1);
    expect(binBoardGameWeight(1.3)).toBe(1.5);
    expect(binBoardGameWeight(0.1)).toBe(0.5);
    expect(binBoardGameWeight(5.4)).toBe(5);
  });
});

describe("boardGameWeightHistogramEntries", () => {
  it("returns empty when no weights", () => {
    expect(boardGameWeightHistogramEntries([null, 0])).toEqual([]);
  });

  it("fills all 0.5 bins when any weight exists", () => {
    const entries = boardGameWeightHistogramEntries([2.1, 2.2, 4.8]);
    expect(entries).toHaveLength(10);
    expect(entries.find((e) => e.period === "2")?.count).toBe(2);
    expect(entries.find((e) => e.period === "5")?.count).toBe(1);
    expect(entries.find((e) => e.period === "0.5")?.count).toBe(0);
  });
});

describe("parseBoardGameWeightScope", () => {
  it("accepts known scopes and defaults to all", () => {
    expect(parseBoardGameWeightScope("played")).toBe("played");
    expect(parseBoardGameWeightScope("nope")).toBe("all");
    expect(boardGameWeightScopeWhere("planToPlay")).toEqual({ status: "plan to play" });
    expect(boardGameWeightScopeWhere("played")).toEqual({ status: "played" });
    expect(boardGameWeightScopeWhere("inCollection")).toEqual({ own: true });
    expect(boardGameWeightScopeWhere("wantToBuy")).toEqual({ wantToBuy: true });
    expect(boardGameWeightScopeWhere("all")).toBeUndefined();
  });
});

describe("parseBoardGameWeightBin", () => {
  it("parses chart bin labels", () => {
    expect(parseBoardGameWeightBin("2.5")).toBe(2.5);
    expect(parseBoardGameWeightBin("2")).toBe(2);
    expect(parseBoardGameWeightBin("bad")).toBeNull();
  });
});

describe("sumMetricByPeriod", () => {
  it("sums values by month", () => {
    const entries = sumMetricByPeriod(
      [
        { at: new Date(Date.UTC(2026, 0, 5)), value: 100 },
        { at: new Date(Date.UTC(2026, 0, 20)), value: 50 },
        { at: new Date(Date.UTC(2026, 1, 1)), value: 10 },
      ],
      "month"
    );
    expect(entries).toEqual([
      { period: "2026-01", hours: 150, count: 2 },
      { period: "2026-02", hours: 10, count: 1 },
    ]);
  });

  it("buckets by the user's timezone offset", () => {
    // 2026-01-01 02:00 UTC is still 2025-12-31 in UTC-3.
    const entries = sumMetricByPeriod(
      [{ at: new Date(Date.UTC(2026, 0, 1, 2, 0, 0)), value: 5 }],
      "month",
      -180
    );
    expect(entries).toEqual([{ period: "2025-12", hours: 5, count: 1 }]);
  });
});
