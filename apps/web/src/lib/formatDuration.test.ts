import { describe, expect, it } from "vitest";
import { formatTimeToFinish } from "./formatDuration";

describe("formatTimeToFinish", () => {
  const startedAt = "2026-01-01T00:00:00.000Z";
  const completedAt = "2026-01-31T00:00:00.000Z";

  it("localizes month labels", () => {
    expect(formatTimeToFinish(startedAt, completedAt, "en")).toBe("1 month");
    expect(formatTimeToFinish(startedAt, completedAt, "pt-BR")).toBe("1 mês");
    expect(formatTimeToFinish(startedAt, completedAt, "es")).toBe("1 mes");
  });

  it("localizes day and week labels", () => {
    expect(formatTimeToFinish("2026-01-01T00:00:00.000Z", "2026-01-04T00:00:00.000Z", "pt-BR")).toBe(
      "3 dias"
    );
    expect(formatTimeToFinish("2026-01-01T00:00:00.000Z", "2026-01-15T00:00:00.000Z", "es")).toBe(
      "2 semanas"
    );
  });

  it("returns an empty string when the completion date is not after the start", () => {
    expect(formatTimeToFinish(startedAt, startedAt, "pt-BR")).toBe("");
  });
});
