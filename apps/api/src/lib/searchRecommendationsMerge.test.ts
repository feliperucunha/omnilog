import { describe, expect, it, vi } from "vitest";
import type { SearchResult } from "@geeklogs/shared";
import { collectFromSeeds, topUpFromPopular } from "./searchRecommendationsMerge.js";

const r = (id: string, title = id): SearchResult => ({
  id,
  title,
  image: null,
  year: null,
  subtitle: null,
});

describe("collectFromSeeds", () => {
  it("dedupes by id and respects exclude set", async () => {
    const fetchOne = vi.fn(async (seed: string) => {
      if (seed === "a") return [r("1"), r("2")];
      if (seed === "b") return [r("2"), r("3")];
      return [];
    });
    const out = await collectFromSeeds(["a", "b"], fetchOne, new Set(["9"]), 10);
    expect(fetchOne).toHaveBeenCalledTimes(2);
    expect(out.map((x) => x.id)).toEqual(["1", "2", "3"]);
  });

  it("stops at max", async () => {
    const fetchOne = vi.fn(async () => [r("1"), r("2"), r("3")]);
    const out = await collectFromSeeds(["x"], fetchOne, new Set(), 2);
    expect(out).toHaveLength(2);
  });

  it("returns empty when seeds empty", async () => {
    const fetchOne = vi.fn();
    const out = await collectFromSeeds([], fetchOne, new Set(), 5);
    expect(out).toEqual([]);
    expect(fetchOne).not.toHaveBeenCalled();
  });
});

describe("topUpFromPopular", () => {
  it("fills from popular without duplicating current or excluded ids", async () => {
    const current = [r("1")];
    const popular = vi.fn(async () => [r("1"), r("2"), r("3")]);
    const out = await topUpFromPopular(current, popular, new Set(["3"]), 4);
    expect(out.map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("truncates current to max before fetching", async () => {
    const current = [r("1"), r("2")];
    const popular = vi.fn(async () => [r("3")]);
    const out = await topUpFromPopular(current, popular, new Set(), 2);
    expect(out).toHaveLength(2);
    expect(popular).not.toHaveBeenCalled();
  });
});
