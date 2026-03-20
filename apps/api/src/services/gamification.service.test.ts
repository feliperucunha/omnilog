/**
 * Unit tests for badge/review stats actions.
 * Ensures handleReviewCreated updates UserReviewStats so milestone progress reflects new reviews.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleReviewCreated, handleReviewRemoved } from "./gamification.service.js";

const mockFindUniqueReviewStats = vi.fn();
const mockCreateReviewStats = vi.fn();
const mockUpsertReviewStats = vi.fn();
const mockFindUniqueUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockUpdateReviewStats = vi.fn();
const mockBadgeFindMany = vi.fn();
const mockUserBadgeFindMany = vi.fn();
const mockUserBadgeCreate = vi.fn();
const mockLogGroupBy = vi.fn();
const mockLogReactionCount = vi.fn();

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    userReviewStats: {
      findUnique: (...args: unknown[]) => mockFindUniqueReviewStats(...args),
      create: (...args: unknown[]) => mockCreateReviewStats(...args),
      upsert: (...args: unknown[]) => mockUpsertReviewStats(...args),
      update: (...args: unknown[]) => mockUpdateReviewStats(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockFindUniqueUser(...args),
      update: (...args: unknown[]) => mockUpdateUser(...args),
    },
    badge: { findMany: (...args: unknown[]) => mockBadgeFindMany(...args) },
    userBadge: {
      findMany: (...args: unknown[]) => mockUserBadgeFindMany(...args),
      create: (...args: unknown[]) => mockUserBadgeCreate(...args),
    },
    log: { groupBy: (...args: unknown[]) => mockLogGroupBy(...args) },
    logReaction: { count: (...args: unknown[]) => mockLogReactionCount(...args) },
  },
}));

const userId = "user-1";

const emptyStats = {
  userId,
  movieReviews: 0,
  tvShowReviews: 0,
  animeReviews: 0,
  mangaReviews: 0,
  comicReviews: 0,
  bookReviews: 0,
  gameReviews: 0,
  boardGameReviews: 0,
  totalReviews: 0,
  distinctMediaReviewed: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUniqueUser.mockResolvedValue({ lastReviewDate: null, currentStreak: 0 });
  mockUpsertReviewStats.mockResolvedValue(undefined);
  mockUpdateUser.mockResolvedValue(undefined);
  mockBadgeFindMany.mockResolvedValue([]);
  mockUserBadgeFindMany.mockResolvedValue([]);
  mockUserBadgeCreate.mockResolvedValue(undefined);
  mockLogGroupBy.mockResolvedValue([]);
  mockLogReactionCount.mockResolvedValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleReviewCreated", () => {
  it("returns empty array when reviewText is null or empty", async () => {
    expect(await handleReviewCreated(userId, "log-1", "movies", null)).toEqual([]);
    expect(await handleReviewCreated(userId, "log-1", "movies", "")).toEqual([]);
    expect(await handleReviewCreated(userId, "log-1", "movies", "   ")).toEqual([]);
    expect(mockUpsertReviewStats).not.toHaveBeenCalled();
  });

  it("returns empty array when media type is not mapped to badge stats", async () => {
    expect(await handleReviewCreated(userId, "log-1", "unknown_medium", "Great game")).toEqual([]);
    expect(mockUpsertReviewStats).not.toHaveBeenCalled();
  });

  it("upserts UserReviewStats with incremented movie review count (first review)", async () => {
    mockFindUniqueReviewStats.mockResolvedValue(null);
    mockCreateReviewStats.mockResolvedValue({ ...emptyStats, userId });

    await handleReviewCreated(userId, "log-1", "movies", "Good film");

    expect(mockUpsertReviewStats).toHaveBeenCalledTimes(1);
    const call = mockUpsertReviewStats.mock.calls[0][0];
    expect(call.where).toEqual({ userId });
    expect(call.create.movieReviews).toBe(1);
    expect(call.create.totalReviews).toBe(1);
    expect(mockUpdateUser).toHaveBeenCalledWith({
      where: { id: userId },
      data: expect.objectContaining({ lastReviewDate: expect.any(Date), currentStreak: expect.any(Number) }),
    });
  });

  it("upserts UserReviewStats with incremented count when user already has stats", async () => {
    mockFindUniqueReviewStats.mockResolvedValue({
      ...emptyStats,
      movieReviews: 2,
      totalReviews: 2,
      distinctMediaReviewed: 1,
    });

    await handleReviewCreated(userId, "log-1", "movies", "Another review");

    expect(mockUpsertReviewStats).toHaveBeenCalledTimes(1);
    const call = mockUpsertReviewStats.mock.calls[0][0];
    expect(call.update.movieReviews).toBe(3);
    expect(call.update.totalReviews).toBe(3);
  });

  it("updates streak when last review was yesterday", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    mockFindUniqueReviewStats.mockResolvedValue({ ...emptyStats, movieReviews: 1, totalReviews: 1 });
    mockFindUniqueUser.mockResolvedValue({ lastReviewDate: yesterday, currentStreak: 2 });

    await handleReviewCreated(userId, "log-1", "movies", "Review");

    expect(mockUpdateUser).toHaveBeenCalledWith({
      where: { id: userId },
      data: expect.objectContaining({ currentStreak: 3 }),
    });
  });
});

describe("handleReviewRemoved", () => {
  it("does nothing when media type is not mapped to badge stats", async () => {
    await handleReviewRemoved(userId, "unknown_medium");
    expect(mockFindUniqueReviewStats).not.toHaveBeenCalled();
    expect(mockUpdateReviewStats).not.toHaveBeenCalled();
  });

  it("decrements movie review count and updates UserReviewStats", async () => {
    mockFindUniqueReviewStats.mockResolvedValue({
      ...emptyStats,
      movieReviews: 3,
      totalReviews: 3,
      distinctMediaReviewed: 1,
    });
    mockUpdateReviewStats.mockResolvedValue(undefined);

    await handleReviewRemoved(userId, "movies");

    expect(mockUpdateReviewStats).toHaveBeenCalledTimes(1);
    const call = mockUpdateReviewStats.mock.calls[0][0];
    expect(call.where).toEqual({ userId });
    expect(call.data.movieReviews).toBe(2);
    expect(call.data.totalReviews).toBe(2);
  });

  it("does not decrement below zero", async () => {
    mockFindUniqueReviewStats.mockResolvedValue({
      ...emptyStats,
      movieReviews: 1,
      totalReviews: 1,
    });
    mockUpdateReviewStats.mockResolvedValue(undefined);

    await handleReviewRemoved(userId, "movies");

    const call = mockUpdateReviewStats.mock.calls[0][0];
    expect(call.data.movieReviews).toBe(0);
    expect(call.data.totalReviews).toBe(0);
  });
});
