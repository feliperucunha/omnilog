import { describe, expect, it } from "vitest";
import { resortLogsByWeight } from "./backfillBoardGameWeight.js";

describe("resortLogsByWeight", () => {
  it("orders by averageWeight descending", () => {
    const logs = [
      { id: "a", averageWeight: 2.1, updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", averageWeight: 4.5, updatedAt: "2026-01-02T00:00:00.000Z" },
      { id: "c", averageWeight: 1.2, updatedAt: "2026-01-03T00:00:00.000Z" },
    ];
    expect(resortLogsByWeight(logs, "weightDesc").map((l) => l.id)).toEqual(["b", "a", "c"]);
  });

  it("orders by averageWeight ascending", () => {
    const logs = [
      { id: "a", averageWeight: 2.1, updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", averageWeight: 4.5, updatedAt: "2026-01-02T00:00:00.000Z" },
    ];
    expect(resortLogsByWeight(logs, "weightAsc").map((l) => l.id)).toEqual(["a", "b"]);
  });
});
