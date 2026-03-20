/**
 * Unit tests for milestone progress (badge meter).
 * Mocks Prisma to verify getMilestoneProgress with empty table, missing table, and with milestones.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMilestoneProgress } from "./milestone.service.js";

const mockFindUnique = vi.fn();
const mockGroupBy = vi.fn();
const mockFindMany = vi.fn();

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    userReviewStats: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    log: { groupBy: (...args: unknown[]) => mockGroupBy(...args) },
    milestone: { findMany: (...args: unknown[]) => mockFindMany(...args) },
  },
}));

const userId = "user-1";

const emptyReviewStats = {
  movieReviews: 0,
  tvShowReviews: 0,
  animeReviews: 0,
  mangaReviews: 0,
  comicReviews: 0,
  bookReviews: 0,
  gameReviews: 0,
  boardGameReviews: 0,
  totalReviews: 0,
};

const emptyLogGroupBy: { mediaType: string; _count: { id: number } }[] = [];

function logGroupByFromCounts(counts: Record<string, number>): { mediaType: string; _count: { id: number } }[] {
  const mediaTypes = ["movies", "tv", "anime", "manga", "comics", "books", "games", "boardgames"];
  return mediaTypes
    .filter((m) => (counts[m] ?? 0) > 0)
    .map((mediaType) => ({ mediaType, _count: { id: counts[mediaType] ?? 0 } }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue(null);
  mockGroupBy.mockResolvedValue(emptyLogGroupBy);
  mockFindMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getMilestoneProgress", () => {
  it("returns perMedium and global with current counts when Milestone table is empty", async () => {
    mockFindUnique.mockResolvedValue({
      ...emptyReviewStats,
      movieReviews: 2,
      totalReviews: 2,
    });
    mockGroupBy.mockResolvedValue(logGroupByFromCounts({ movies: 3 }));
    mockFindMany.mockResolvedValue([]);

    const progress = await getMilestoneProgress(userId);

    expect(progress.perMedium).toHaveLength(8);
    const movies = progress.perMedium.find((p) => p.mediaType === "movies");
    expect(movies).toBeDefined();
    expect(movies!.reviews.current).toBe(2);
    expect(movies!.reviews.next).toBeNull();
    expect(movies!.reviews.earned).toEqual([]);
    expect(movies!.logs.current).toBe(3);
    expect(movies!.logs.next).toBeNull();
    expect(progress.global.reviews.current).toBe(2);
    expect(progress.global.logs.current).toBe(3);
    expect(progress.global.reviews.next).toBeNull();
    expect(progress.global.reviews.earned).toEqual([]);
  });

  it("returns fallback with real counts when Milestone table does not exist (findMany throws)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFindUnique.mockResolvedValue({
      ...emptyReviewStats,
      bookReviews: 1,
      totalReviews: 1,
    });
    mockGroupBy.mockResolvedValue(logGroupByFromCounts({ books: 1 }));
    mockFindMany.mockRejectedValue(new Error('relation "Milestone" does not exist'));

    const progress = await getMilestoneProgress(userId);

    expect(progress.perMedium).toHaveLength(8);
    const books = progress.perMedium.find((p) => p.mediaType === "books");
    expect(books!.reviews.current).toBe(1);
    expect(books!.logs.current).toBe(1);
    expect(books!.reviews.next).toBeNull();
    expect(books!.reviews.earned).toEqual([]);
    expect(progress.global.reviews.current).toBe(1);
    expect(progress.global.logs.current).toBe(1);
    consoleSpy.mockRestore();
  });

  it("returns next milestone and earned when milestones exist and user has progress", async () => {
    mockFindUnique.mockResolvedValue({
      ...emptyReviewStats,
      movieReviews: 3,
      totalReviews: 3,
    });
    mockGroupBy.mockResolvedValue(logGroupByFromCounts({ movies: 7 }));
    mockFindMany.mockResolvedValue([
      { metric: "reviews", scope: "per_medium", medium: "MOVIE", threshold: 1, label: "First", icon: "🎬", sortOrder: 0 },
      { metric: "reviews", scope: "per_medium", medium: "MOVIE", threshold: 5, label: "Reviewer I", icon: "📝", sortOrder: 1 },
      { metric: "logs", scope: "per_medium", medium: "MOVIE", threshold: 1, label: "First log", icon: "📌", sortOrder: 2 },
      { metric: "logs", scope: "per_medium", medium: "MOVIE", threshold: 5, label: "Logger I", icon: "📋", sortOrder: 3 },
      { metric: "logs", scope: "per_medium", medium: "MOVIE", threshold: 10, label: "Logger II", icon: "📚", sortOrder: 4 },
    ]);

    const progress = await getMilestoneProgress(userId);

    const movies = progress.perMedium.find((p) => p.mediaType === "movies");
    expect(movies!.reviews.current).toBe(3);
    expect(movies!.reviews.earned).toHaveLength(1); // threshold 1
    expect(movies!.reviews.next).toEqual({ threshold: 5, label: "Reviewer I", icon: "📝" });
    expect(movies!.reviews.progressPct).toBeGreaterThan(0);
    expect(movies!.logs.current).toBe(7);
    expect(movies!.logs.earned).toHaveLength(2); // 1 and 5
    expect(movies!.logs.next).toEqual({ threshold: 10, label: "Logger II", icon: "📚" });
  });

  it("returns zero counts and no next/earned when user has no stats and no milestones", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockGroupBy.mockResolvedValue(emptyLogGroupBy);
    mockFindMany.mockResolvedValue([]);

    const progress = await getMilestoneProgress(userId);

    expect(progress.global.reviews.current).toBe(0);
    expect(progress.global.logs.current).toBe(0);
    expect(progress.global.reviews.next).toBeNull();
    expect(progress.global.reviews.earned).toEqual([]);
  });
});
