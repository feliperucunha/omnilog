import { describe, it, expect, vi, beforeEach } from "vitest";

const searchBoardGames = vi.fn();

vi.mock("./bgg.js", () => ({
  searchBoardGames: (...args: unknown[]) => searchBoardGames(...args),
}));

vi.mock("./ludopedia.js", () => ({
  searchBoardGamesLudopedia: vi.fn(),
}));

import { fetchBoardGameRecommendationsMerged } from "./boardGameRecommendations.js";

const meta = { link: "https://example.com", tutorial: "tutorial" };

beforeEach(() => {
  searchBoardGames.mockReset();
});

describe("fetchBoardGameRecommendationsMerged", () => {
  it("falls back to default queries when affinity searches return no matches", async () => {
    searchBoardGames.mockImplementation(async (q: string) => {
      if (q === "strategy") {
        return {
          results: [
            {
              id: "13",
              title: "Catan",
              image: null,
              year: "1995",
              subtitle: null,
              score: 7.5,
            },
          ],
        };
      }
      return { results: [] };
    });

    const outcome = await fetchBoardGameRecommendationsMerged({
      logs: [
        {
          genres: JSON.stringify(["Hand Management"]),
          mechanics: null,
          grade: 9,
          status: "played",
          affinityContext: null,
        },
      ],
      exclude: new Set(),
      maxResults: 16,
      provider: "bgg",
      apiToken: "token",
      sort: undefined,
      bggMeta: meta,
      ludopediaMeta: meta,
      maxSearchCalls: 2,
    });

    expect("requiresApiKey" in outcome).toBe(false);
    if ("requiresApiKey" in outcome) return;
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0]?.id).toBe("13");
    expect(searchBoardGames.mock.calls.some((c) => c[0] === "strategy")).toBe(true);
    expect(searchBoardGames.mock.calls[0]?.[0]).not.toBe("strategy");
  });
});
