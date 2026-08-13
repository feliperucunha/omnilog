import { describe, expect, it } from "vitest";
import { resolveLogStatusDates } from "./logStatusDates.js";

const now = new Date("2026-07-22T15:00:00.000Z");
const existingStarted = new Date("2026-01-01T12:00:00.000Z");
const existingCompleted = new Date("2026-02-01T12:00:00.000Z");

describe("resolveLogStatusDates", () => {
  it("sets startedAt when status changes to reading and body sends null", () => {
    const result = resolveLogStatusDates({
      status: "reading",
      previousStatus: "plan to read",
      statusProvided: true,
      bodyStartedAt: null,
      bodyCompletedAt: undefined,
      existingStartedAt: null,
      existingCompletedAt: null,
      now,
    });
    expect(result.startedAt).toEqual(now);
    expect(result.completedAt).toBeUndefined();
  });

  it("sets completedAt when status changes to dropped", () => {
    const result = resolveLogStatusDates({
      status: "dropped",
      previousStatus: "watching",
      statusProvided: true,
      bodyStartedAt: undefined,
      bodyCompletedAt: undefined,
      existingStartedAt: existingStarted,
      existingCompletedAt: null,
      now,
    });
    expect(result.completedAt).toEqual(now);
  });

  it("sets completedAt when status changes to completed without body dates", () => {
    const result = resolveLogStatusDates({
      status: "completed",
      previousStatus: "watching",
      statusProvided: true,
      bodyStartedAt: undefined,
      bodyCompletedAt: undefined,
      existingStartedAt: existingStarted,
      existingCompletedAt: null,
      now,
    });
    expect(result.completedAt).toEqual(now);
    expect(result.startedAt).toBeUndefined();
  });

  it("keeps existing startedAt when status stays in progress", () => {
    const result = resolveLogStatusDates({
      status: "watching",
      previousStatus: "watching",
      statusProvided: false,
      bodyStartedAt: undefined,
      bodyCompletedAt: undefined,
      existingStartedAt: existingStarted,
      existingCompletedAt: null,
      now,
    });
    expect(result.startedAt).toBeUndefined();
  });

  it("updates completedAt when status changes to read even if one existed", () => {
    const result = resolveLogStatusDates({
      status: "read",
      previousStatus: "reading",
      statusProvided: true,
      bodyStartedAt: undefined,
      bodyCompletedAt: undefined,
      existingStartedAt: existingStarted,
      existingCompletedAt: existingCompleted,
      now,
    });
    expect(result.completedAt).toEqual(now);
  });

  it("parses explicit body dates", () => {
    const result = resolveLogStatusDates({
      status: "reading",
      previousStatus: null,
      statusProvided: true,
      bodyStartedAt: "2026-03-15T12:00:00.000Z",
      bodyCompletedAt: undefined,
      existingStartedAt: null,
      existingCompletedAt: null,
      now,
    });
    expect(result.startedAt?.toISOString()).toBe("2026-03-15T12:00:00.000Z");
  });

  it("clears startedAt when body null and status does not imply start date", () => {
    const result = resolveLogStatusDates({
      status: "plan to read",
      previousStatus: "reading",
      statusProvided: true,
      bodyStartedAt: null,
      bodyCompletedAt: undefined,
      existingStartedAt: existingStarted,
      existingCompletedAt: null,
      now,
    });
    expect(result.startedAt).toBeNull();
  });
});
