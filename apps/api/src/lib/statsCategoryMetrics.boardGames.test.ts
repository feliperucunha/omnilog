import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMatchFindMany = vi.fn();
const mockLogFindMany = vi.fn();

vi.mock("./prisma.js", () => ({
  prisma: {
    boardGameMatch: {
      findMany: (...args: unknown[]) => mockMatchFindMany(...args),
    },
    log: {
      findMany: (...args: unknown[]) => mockLogFindMany(...args),
    },
  },
}));

import { recentBoardGamesForStats } from "./statsCategoryMetrics.js";

const userId = "user-1";

function ownLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    externalId: "bgg-1",
    title: "Catan",
    image: null,
    boardGameSource: "bgg",
    matchesPlayed: null,
    completedAt: new Date("2026-05-01T12:00:00.000Z"),
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    ...overrides,
  };
}

function matchRow(overrides: Record<string, unknown> = {}) {
  return {
    playedAt: new Date("2026-05-01T12:00:00.000Z"),
    createdAt: new Date("2026-05-01T12:00:00.000Z"),
    players: JSON.stringify([{ name: "Felipe", score: 10, winner: true, appUserId: userId }]),
    log: {
      id: "log-1",
      userId,
      externalId: "bgg-1",
      title: "Catan",
      image: null,
      boardGameSource: "bgg",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMatchFindMany.mockResolvedValue([]);
  mockLogFindMany.mockResolvedValue([]);
});

describe("recentBoardGamesForStats mostPlayed", () => {
  it("uses the log matchesPlayed count when there are no detailed match rows", async () => {
    mockLogFindMany.mockResolvedValue([ownLog({ matchesPlayed: 4 })]);

    const result = await recentBoardGamesForStats(userId, undefined, "mostPlayed");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      externalId: "bgg-1",
      matchCount: 4,
      wins: 0,
      lastScore: null,
    });
  });

  it("counts distinct same-day sessions but collapses host/tagged duplicate copies", async () => {
    const sameDay = new Date("2026-05-01T12:00:00.000Z");
    mockLogFindMany.mockResolvedValue([ownLog()]);
    mockMatchFindMany.mockResolvedValue([
      matchRow({ playedAt: sameDay, createdAt: new Date("2026-05-01T12:00:00.000Z") }),
      matchRow({
        playedAt: sameDay,
        createdAt: new Date("2026-05-01T12:00:00.000Z"),
        players: JSON.stringify([
          { name: "Felipe", score: 7, winner: false, appUserId: userId },
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
      matchRow({
        playedAt: new Date("2026-05-01T18:00:00.000Z"),
        createdAt: new Date("2026-05-01T18:00:00.000Z"),
        players: JSON.stringify([
          { name: "Felipe", score: 7, winner: false, appUserId: userId },
        ]),
      }),
    ]);

    const result = await recentBoardGamesForStats(userId, undefined, "mostPlayed");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      externalId: "bgg-1",
      matchCount: 2,
      wins: 1,
      lastScore: 7,
      lastScoreTrend: "lower",
    });
  });
});
