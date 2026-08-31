import { describe, expect, it } from "vitest";
import { completedAtBoundsForStatsPeriod } from "./statisticsScope.js";

describe("completedAtBoundsForStatsPeriod", () => {
  it("uses UTC midnight when offset is 0", () => {
    const bounds = completedAtBoundsForStatsPeriod("2026-01", "month", 0);
    expect(bounds?.gte.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(bounds?.lte.toISOString()).toBe("2026-01-31T23:59:59.999Z");
  });

  it("shifts bounds into the user's timezone", () => {
    // UTC-3: local Jan 2026 starts at 2026-01-01 03:00 UTC.
    const bounds = completedAtBoundsForStatsPeriod("2026-01", "month", -180);
    expect(bounds?.gte.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(bounds?.lte.toISOString()).toBe("2026-02-01T02:59:59.999Z");
  });
});
