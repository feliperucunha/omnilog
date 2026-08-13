import { describe, expect, it } from "vitest";
import {
  activityInRangeWhere,
  completedActivityWhere,
  completedLogWhere,
  COMPLETED_STATUS_LIST,
  effectiveCompletedAt,
  effectiveStartedAt,
} from "./logActivityDates.js";

const d = (iso: string) => new Date(iso);
const range = { gte: d("2026-07-01T00:00:00.000Z"), lte: d("2026-07-31T23:59:59.999Z") };

describe("effectiveCompletedAt", () => {
  it("uses completedAt when present without a completed status", () => {
    const completed = d("2026-07-10T12:00:00.000Z");
    expect(
      effectiveCompletedAt({
        status: "plan to read",
        startedAt: null,
        completedAt: completed,
        updatedAt: d("2026-07-15T12:00:00.000Z"),
      })
    ).toEqual(completed);
  });

  it("falls back to updatedAt for read status without completedAt", () => {
    const updated = d("2026-07-15T12:00:00.000Z");
    expect(
      effectiveCompletedAt({
        status: "read",
        startedAt: null,
        completedAt: null,
        updatedAt: updated,
      })
    ).toEqual(updated);
  });

  it("prefers updatedAt over stale completedAt when marked read", () => {
    const updated = d("2026-07-15T12:00:00.000Z");
    expect(
      effectiveCompletedAt({
        status: "read",
        startedAt: null,
        completedAt: d("2020-01-01T12:00:00.000Z"),
        updatedAt: updated,
      })
    ).toEqual(updated);
  });

  it("uses explicit completedAt when newer than updatedAt", () => {
    const completed = d("2026-08-01T12:00:00.000Z");
    const updated = d("2026-07-15T12:00:00.000Z");
    expect(
      effectiveCompletedAt({
        status: "read",
        startedAt: null,
        completedAt: completed,
        updatedAt: updated,
      })
    ).toEqual(completed);
  });

  it("returns null for plan to read without completedAt", () => {
    expect(
      effectiveCompletedAt({
        status: "plan to read",
        startedAt: null,
        completedAt: null,
        updatedAt: d("2026-07-15T12:00:00.000Z"),
      })
    ).toBeNull();
  });
});

describe("effectiveStartedAt", () => {
  it("falls back to updatedAt for reading status without startedAt", () => {
    const updated = d("2026-07-05T12:00:00.000Z");
    expect(
      effectiveStartedAt({
        status: "reading",
        startedAt: null,
        completedAt: null,
        updatedAt: updated,
      })
    ).toEqual(updated);
  });
});

describe("completedLogWhere", () => {
  it("counts read status updated in range even when completedAt is set", () => {
    const where = completedLogWhere(range);
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { completedAt: { gte: range.gte, lte: range.lte } },
        {
          AND: [
            { status: { in: COMPLETED_STATUS_LIST } },
            { updatedAt: { gte: range.gte, lte: range.lte } },
          ],
        },
      ])
    );
    const statusBranch = (where.OR as unknown[])[1] as { AND: unknown[] };
    expect(statusBranch.AND).not.toContainEqual({ completedAt: null });
  });
});

describe("completedActivityWhere", () => {
  it("includes finished status rows with updatedAt in range", () => {
    const where = completedActivityWhere(range);
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { completedAt: { gte: range.gte, lte: range.lte } },
        {
          AND: [
            { status: { in: expect.arrayContaining(["read", "dropped"]) } },
            { updatedAt: { gte: range.gte, lte: range.lte } },
          ],
        },
      ])
    );
  });
});

describe("activityInRangeWhere", () => {
  it("combines started and completed activity clauses", () => {
    const where = activityInRangeWhere(range);
    expect(where.OR?.length).toBeGreaterThanOrEqual(2);
  });
});
