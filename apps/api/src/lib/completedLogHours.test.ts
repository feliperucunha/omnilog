import { describe, expect, it } from "vitest";
import {
  hoursFromCompletedLogForStats,
  READING_PAGES_PER_HOUR,
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

  it("prefers summed session duration over match count for boardgames", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: null,
        startedAt: null,
        mediaType: "boardgames",
        hoursToBeat: null,
        matchesPlayed: 2,
        boardGameSessionHours: 2.5,
      })
    ).toBe(2.5);
  });

  it("uses match count when session hours are missing or zero", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: null,
        startedAt: null,
        mediaType: "boardgames",
        hoursToBeat: null,
        matchesPlayed: 4,
        boardGameSessionHours: 0,
      })
    ).toBe(4);
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

  it("falls back to contentHours for games without hoursToBeat", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: 8,
        startedAt: null,
        mediaType: "games",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBe(8);
  });

  it("uses contentHours for movies, tv, and anime", () => {
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
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: 12,
        startedAt: null,
        mediaType: "tv",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBe(12);
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: 0.4,
        startedAt: null,
        mediaType: "anime",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBe(0.4);
  });

  it("does not use calendar elapsed time as watch or play time", () => {
    const started = d("2024-01-01T00:00:00.000Z");
    const completed = d("2024-01-15T00:00:00.000Z");
    expect(
      hoursFromCompletedLogForStats({
        completedAt: completed,
        contentHours: null,
        startedAt: started,
        mediaType: "movies",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBeNull();
    expect(
      hoursFromCompletedLogForStats({
        completedAt: completed,
        contentHours: null,
        startedAt: started,
        mediaType: "games",
        hoursToBeat: null,
        matchesPlayed: null,
      })
    ).toBeNull();
    expect(
      hoursFromCompletedLogForStats({
        completedAt: completed,
        contentHours: null,
        startedAt: started,
        mediaType: "books",
        hoursToBeat: null,
        matchesPlayed: null,
        pagesRead: 150,
      })
    ).toBe(150 / READING_PAGES_PER_HOUR);
  });

  it("prefers contentHours over pages for reading media", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: 6,
        startedAt: null,
        mediaType: "books",
        hoursToBeat: null,
        matchesPlayed: null,
        pagesRead: 300,
      })
    ).toBe(6);
  });

  it("uses updatedAt when status is read but completedAt is stale", () => {
    const updated = d("2024-06-01T00:00:00.000Z");
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2020-01-01T00:00:00.000Z"),
        contentHours: null,
        startedAt: null,
        mediaType: "books",
        hoursToBeat: null,
        matchesPlayed: null,
        pagesRead: 300,
        status: "read",
        updatedAt: updated,
      })
    ).toBe(10);
  });

  it("estimates reading hours from pagesRead", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: null,
        startedAt: null,
        mediaType: "books",
        hoursToBeat: null,
        matchesPlayed: null,
        pagesRead: 150,
      })
    ).toBe(5);
  });

  it("returns 0 hours for completed reading log without pages or runtime", () => {
    expect(
      hoursFromCompletedLogForStats({
        completedAt: d("2024-01-01T00:00:00.000Z"),
        contentHours: null,
        startedAt: null,
        mediaType: "manga",
        hoursToBeat: null,
        matchesPlayed: null,
        pagesRead: null,
      })
    ).toBe(0);
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
