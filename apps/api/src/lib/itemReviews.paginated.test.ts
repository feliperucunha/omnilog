import { describe, expect, it, vi } from "vitest";
import { buildReviewerSortRows } from "./itemReviews.js";

describe("loadItemReviewsPaginated reviewer sort", () => {
  it("paginates by user without loading full user rows for all logs first", async () => {
    const prisma = {
      log: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "l1",
            userId: "u1",
            grade: 8,
            review: "Great",
            createdAt: new Date("2024-01-02"),
          },
          {
            id: "l2",
            userId: "u2",
            grade: 9,
            review: "Better",
            createdAt: new Date("2024-02-01"),
          },
        ]),
        aggregate: vi.fn().mockResolvedValue({ _avg: { grade: 8.5 } }),
      },
      scopedReview: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const rows = await buildReviewerSortRows(
      prisma as never,
      "movies",
      "ext-1",
      "recent"
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.userId).toBe("u2");
    expect(rows[1]?.userId).toBe("u1");
  });
});
