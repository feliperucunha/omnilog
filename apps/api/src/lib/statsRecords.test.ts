import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogFindMany = vi.fn();
const mockMatchFindMany = vi.fn();
const mockItemDetailCacheFindMany = vi.fn();

vi.mock("./prisma.js", () => ({
  prisma: {
    log: {
      findMany: (...args: unknown[]) => mockLogFindMany(...args),
    },
    boardGameMatch: {
      findMany: (...args: unknown[]) => mockMatchFindMany(...args),
    },
    itemDetailCache: {
      findMany: (...args: unknown[]) => mockItemDetailCacheFindMany(...args),
    },
  },
}));

import { getStatsRecordsForUser } from "./statsRecords.js";

const userId = "user-1";

function logRow(overrides: Record<string, unknown> = {}) {
  const completedAt = new Date("2026-01-10T12:00:00.000Z");
  return {
    id: "log-1",
    mediaType: "movies",
    externalId: "movie-1",
    title: "Movie One",
    image: null,
    status: "completed",
    grade: null,
    completedAt,
    startedAt: null,
    updatedAt: completedAt,
    createdAt: completedAt,
    contentHours: null,
    hoursToBeat: null,
    gamePlatform: null,
    season: null,
    episode: null,
    chapter: null,
    volume: null,
    pagesRead: null,
    matchesPlayed: null,
    averageWeight: null,
    genres: null,
    boardGameSource: null,
    ...overrides,
  };
}

function matchRow(overrides: Record<string, unknown> = {}) {
  const playedAt = new Date("2026-05-01T12:00:00.000Z");
  return {
    playedAt,
    createdAt: playedAt,
    durationHours: 2,
    players: JSON.stringify([{ name: "Felipe", winner: true, appUserId: userId }]),
    log: {
      id: "log-bg-1",
      userId,
      externalId: "bgg-1",
      title: "Catan",
      image: null,
      boardGameSource: "bgg",
    },
    ...overrides,
  };
}

function recordMap(records: Awaited<ReturnType<typeof getStatsRecordsForUser>>) {
  return new Map(records.map((record) => [record.id, record]));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLogFindMany.mockResolvedValue([]);
  mockMatchFindMany.mockResolvedValue([]);
  mockItemDetailCacheFindMany.mockResolvedValue([]);
});

describe("getStatsRecordsForUser", () => {
  it("returns no records when there is no activity", async () => {
    const records = await getStatsRecordsForUser({
      userId,
      scope: "all",
      periodYear: null,
      tzOffsetMinutes: 0,
    });

    expect(records).toEqual([]);
    expect(mockLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId } })
    );
    expect(mockItemDetailCacheFindMany).not.toHaveBeenCalled();
  });

  it("builds all-scope category champions and cross-media activity records", async () => {
    mockLogFindMany.mockResolvedValue([
      logRow({
        id: "movie-1",
        externalId: "movie-1",
        title: "First Movie",
        mediaType: "movies",
        grade: 8,
        completedAt: new Date("2026-01-01T12:00:00.000Z"),
        updatedAt: new Date("2026-01-01T12:00:00.000Z"),
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
      }),
      logRow({
        id: "tv-1",
        externalId: "tv-1",
        title: "First Show",
        mediaType: "tv",
        grade: 9,
        completedAt: new Date("2026-01-02T12:00:00.000Z"),
        updatedAt: new Date("2026-01-02T12:00:00.000Z"),
        createdAt: new Date("2026-01-02T12:00:00.000Z"),
      }),
      logRow({
        id: "movie-2",
        externalId: "movie-2",
        title: "Second Movie",
        mediaType: "movies",
        grade: 7,
        completedAt: new Date("2026-01-02T18:00:00.000Z"),
        updatedAt: new Date("2026-01-02T18:00:00.000Z"),
        createdAt: new Date("2026-01-02T18:00:00.000Z"),
      }),
    ]);

    const records = recordMap(
      await getStatsRecordsForUser({
        userId,
        scope: "all",
        periodYear: null,
        tzOffsetMinutes: 0,
      })
    );

    expect(records.get("top_rated_movies")?.entries[0]).toMatchObject({
      title: "First Movie",
      rank: 1,
      value: 8,
      unit: "rating",
    });
    expect(records.get("top_rated_tv")?.entries[0]).toMatchObject({
      title: "First Show",
      value: 9,
    });
    expect(records.has("most_active_day")).toBe(false);
    expect(records.has("most_active_year")).toBe(false);
    expect(records.has("longest_streak")).toBe(false);
    expect(records.has("top_rated_books")).toBe(false);
  });

  it("builds fastest and slowest completion records from start and finish dates", async () => {
    mockLogFindMany.mockResolvedValue([
      logRow({
        id: "quick-movie",
        externalId: "quick-movie",
        title: "Quick Movie",
        mediaType: "movies",
        startedAt: new Date("2026-01-05T12:00:00.000Z"),
        completedAt: new Date("2026-01-05T18:00:00.000Z"),
        updatedAt: new Date("2026-01-05T18:00:00.000Z"),
      }),
      logRow({
        id: "medium-book",
        externalId: "medium-book",
        title: "Medium Book",
        mediaType: "books",
        startedAt: new Date("2026-02-01T12:00:00.000Z"),
        completedAt: new Date("2026-02-03T12:00:00.000Z"),
        updatedAt: new Date("2026-02-03T12:00:00.000Z"),
      }),
      logRow({
        id: "slow-tv",
        externalId: "slow-tv",
        title: "Slow TV",
        mediaType: "tv",
        startedAt: new Date("2026-03-01T12:00:00.000Z"),
        completedAt: new Date("2026-03-11T12:00:00.000Z"),
        updatedAt: new Date("2026-03-11T12:00:00.000Z"),
      }),
    ]);

    const records = recordMap(
      await getStatsRecordsForUser({
        userId,
        scope: "all",
        periodYear: null,
        tzOffsetMinutes: 0,
      })
    );

    expect(records.get("fastest_completion")?.entries[0]).toMatchObject({
      title: "Quick Movie",
      value: 0.3,
      unit: "days",
    });
    expect(records.get("slowest_completion")?.entries[0]).toMatchObject({
      title: "Slow TV",
      value: 10,
      unit: "days",
    });
  });

  it("returns only the requested category records", async () => {
    mockLogFindMany.mockResolvedValue([
      logRow({
        id: "game-1",
        externalId: "game-1",
        title: "Long RPG",
        mediaType: "games",
        grade: 9,
        hoursToBeat: 40,
        gamePlatform: "PC",
      }),
      logRow({
        id: "game-2",
        externalId: "game-2",
        title: "Short Game",
        mediaType: "games",
        grade: 8,
        hoursToBeat: 8,
        gamePlatform: "PC",
      }),
      logRow({
        id: "game-3",
        externalId: "game-3",
        title: "Console Game",
        mediaType: "games",
        hoursToBeat: 12,
        gamePlatform: "PS5",
      }),
    ]);

    const records = recordMap(
      await getStatsRecordsForUser({
        userId,
        scope: "games",
        periodYear: null,
        tzOffsetMinutes: 0,
      })
    );

    expect([...records.keys()]).toEqual([
      "highest_rated",
      "most_game_hours",
      "top_game_platform",
    ]);
    expect(records.get("highest_rated")?.entries[0]?.title).toBe("Long RPG");
    expect(records.get("most_game_hours")?.entries[0]).toMatchObject({
      title: "Long RPG",
      value: 40,
      unit: "hours",
    });
    expect(records.get("top_game_platform")?.entries[0]).toMatchObject({
      title: "PC",
      value: 2,
      unit: "items",
    });
  });

  it("filters records to the requested year", async () => {
    mockLogFindMany.mockResolvedValue([
      logRow({
        id: "old-movie",
        externalId: "old-movie",
        title: "Old Favorite",
        mediaType: "movies",
        grade: 8,
        completedAt: new Date("2025-06-01T12:00:00.000Z"),
        updatedAt: new Date("2025-06-01T12:00:00.000Z"),
      }),
      logRow({
        id: "new-movie",
        externalId: "new-movie",
        title: "New Favorite",
        mediaType: "movies",
        grade: 10,
        completedAt: new Date("2026-06-01T12:00:00.000Z"),
        updatedAt: new Date("2026-06-01T12:00:00.000Z"),
      }),
    ]);

    const records = recordMap(
      await getStatsRecordsForUser({
        userId,
        scope: "movies",
        periodYear: 2025,
        tzOffsetMinutes: 0,
      })
    );

    expect(records.get("highest_rated")?.entries).toHaveLength(1);
    expect(records.get("highest_rated")?.entries[0]?.title).toBe("Old Favorite");
  });

  it("dedupes host/tagged board-game sessions and computes wins and win rate", async () => {
    const dayOne = new Date("2026-05-01T12:00:00.000Z");
    const dayTwo = new Date("2026-05-02T12:00:00.000Z");
    const dayThree = new Date("2026-05-03T12:00:00.000Z");
    mockLogFindMany.mockResolvedValue([
      logRow({
        id: "log-bg-1",
        externalId: "bgg-1",
        title: "Catan",
        mediaType: "boardgames",
        grade: 8,
        completedAt: dayOne,
        updatedAt: dayOne,
        createdAt: dayOne,
        boardGameSource: "bgg",
      }),
    ]);
    mockMatchFindMany.mockResolvedValue([
      matchRow({ playedAt: dayOne, createdAt: dayOne, durationHours: 2 }),
      matchRow({
        playedAt: dayOne,
        createdAt: dayOne,
        durationHours: 2,
        players: JSON.stringify([
          { name: "Felipe", winner: false, appUserId: userId },
        ]),
        log: {
          id: "log-tagged",
          userId: "user-2",
          externalId: "bgg-1",
          title: "Catan",
          image: null,
          boardGameSource: "bgg",
        },
      }),
      matchRow({ playedAt: dayTwo, createdAt: dayTwo, durationHours: 3 }),
      matchRow({
        playedAt: dayThree,
        createdAt: dayThree,
        durationHours: 1,
        players: JSON.stringify([
          { name: "Felipe", winner: false, appUserId: userId },
        ]),
      }),
    ]);

    const records = recordMap(
      await getStatsRecordsForUser({
        userId,
        scope: "boardgames",
        periodYear: null,
        tzOffsetMinutes: 0,
      })
    );

    expect(records.get("most_boardgame_matches")?.entries[0]).toMatchObject({
      title: "Catan",
      value: 3,
      unit: "matches",
    });
    expect(records.has("best_boardgame_win_rate")).toBe(false);
    expect(records.get("most_boardgame_wins")?.entries[0]).toMatchObject({
      title: "Catan",
      value: 2,
      unit: "wins",
      secondaryUnit: "winRate",
    });
    expect(
      records.get("most_boardgame_wins")?.entries[0]?.secondaryValue
    ).toBeCloseTo(66.666, 2);
    expect(records.get("longest_boardgame_session")?.entries[0]).toMatchObject({
      title: "Catan",
      value: 3,
      unit: "hours",
    });
  });

  it("uses cached book page counts for longest book and pages read for most pages", async () => {
    mockLogFindMany.mockResolvedValue([
      logRow({
        id: "book-1",
        externalId: "book-1",
        title: "Long Classic",
        mediaType: "books",
        pagesRead: 100,
      }),
      logRow({
        id: "book-2",
        externalId: "book-2",
        title: "Read More Pages",
        mediaType: "books",
        pagesRead: 300,
      }),
    ]);
    mockItemDetailCacheFindMany.mockResolvedValue([
      { externalId: "book-1", pagesCount: 400 },
    ]);

    const records = recordMap(
      await getStatsRecordsForUser({
        userId,
        scope: "books",
        periodYear: null,
        tzOffsetMinutes: 0,
      })
    );

    expect(records.get("longest_book")?.entries[0]).toMatchObject({
      title: "Long Classic",
      value: 400,
      unit: "pages",
    });
    expect(records.get("most_book_pages")?.entries[0]).toMatchObject({
      title: "Read More Pages",
      value: 300,
      unit: "pages",
    });
  });
});
