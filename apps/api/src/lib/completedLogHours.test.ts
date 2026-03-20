import { describe, expect, it } from "vitest";
import {
  FALLBACK_MAX_HOURS,
  hoursFromCompletedLogForStats,
  MS_PER_HOUR,
  rollupHoursFromCompletedLogs,
} from "./completedLogHours.js";

const d = (iso: string) => new Date(iso);

describe("hoursFromCompletedLogForStats", () => {
  it("returns null when not completed", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: null,
        contentHours: 5,
        startedAt: null,
        mediaType: "movies",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBeNull();
  });

  it("uses boardgame matches as hours", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: null,
        startedAt: null,
        mediaType: "boardgames",
        hoursToBeat: null,
        matchesPlayed: 3,
      })
    ).toBe(3);
  });

  it("returns 0 for boardgames with no matches (still a numeric attribution)", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: null,
        startedAt: null,
        mediaType: "boardgames",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBe(0);
  });

  it("prefers hoursToBeat for games", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: 99,
        startedAt: d("2023-01-01T00:00:00.000Z"),
        mediaType: "games",
        hoursToBeat: 12.5,
        matchesPlayed: null,
      })
    ).toBe(12.5);
  });

  it("uses contentHours when set for non-boardgame non-game-hoursToBeat path", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: 2.5,
        startedAt: null,
        mediaType: "movies",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBe(2.5);
  });

  it("derives hours from startedAt to completedAt with cap", () => {
    const started = d("2024-01-01T00:00:00.000Z");
    const completed = new Date(started.getTime() + 3 * MS_PER_HOUR);
    expect(
      hoursFromCompletedLogForStats({
        completedAt: completed,
        contentHours: null,
        startedAt: started,
        mediaType: "movies",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBe(3);
  });

  it("caps derived elapsed hours at FALLBACK_MAX_HOURS", () => {
    const started = d("2024-01-01T00:00:00.000Z");
    const completed = new Date(started.getTime() + (FALLBACK_MAX_HOURS + 10) * MS_PER_HOUR);
    expect(
      hoursFromCompletedLogForStats({
        completedAt: completed,
        contentHours: null,
        startedAt: started,
        mediaType: "anime",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBe(FALLBACK_MAX_HOURS);
  });

  it("returns null when no rule applies", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: null,
        startedAt: null,
        mediaType: "movies",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBeNull();
  });
});

describe("rollupHoursFromCompletedLogs", () => {
  it("sums hours and counts only positive contributions", () => {
    const logs = [
      {
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: 2,
        startedAt: null,
        mediaType: "movies" as const,
        hoursToBeat: null,
        matchesPlayed: null,
      },
      {
        completedAt: d("2024-01-02T00:00:00.000Z"),
        contentHours: null,
        startedAt: null,
        mediaType: "boardgames" as const,
        hoursToBeat: null,
        matchesPlayed: 0,
      },
      {
        completedAt: d("2024-01-03T00:00:00.000Z"),
        contentHours: 1.5,
        startedAt: null,
        mediaType: "tv" as const,
        hoursToBeat: null,
        matchesPlayed: null,
      },
    ];
    const r = rollupHoursFromCompletedLogs(logs);
    expect(r.totalHours).toBe(3.5);
    expect(r.logsWithPositiveHours).toBe(2);
  });

  it("skips null attributions in rollup", () => {
    const logs = [
      {
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: null,
        startedAt: null,
        mediaType: "movies",
        hoursToBeat: null,
        matchesPlayed: null,
      },
      {
        completedAt: d("2024-01-02T00:00:00.000Z"),
        contentHours: 1,
        startedAt: null,
        mediaType: "movies",
        hoursToBeat: null,
        matchesPlayed: null,
      },
    ];
    const r = rollupHoursFromCompletedLogs(logs);
    expect(r.totalHours).toBe(1);
    expect(r.logsWithPositiveHours).toBe(1);
  });
});
