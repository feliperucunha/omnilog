import { describe, expect, it } from "vitest";
import { sortSearchResults } from "./sortSearchResults.js";
import type { SearchResult } from "@geeklogs/shared";

const row = (id: string, title: string, year?: string, score?: number): SearchResult => ({
  id,
  title,
  year: year ?? null,
  score: score ?? null,
  image: null,
});

describe("sortSearchResults", () => {
  it("sorts by score_desc", () => {
    const input = [row("1", "A", "2020", 7), row("2", "B", "2021", 9), row("3", "C", "2019", 5)];
    const out = sortSearchResults(input, "score_desc");
    expect(out.map((r) => r.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by start_date_desc like year_desc", () => {
    const input = [row("1", "A", "2018"), row("2", "B", "2024")];
    const out = sortSearchResults(input, "start_date_desc");
    expect(out.map((r) => r.id)).toEqual(["2", "1"]);
  });

  it("keeps relevance order unchanged", () => {
    const input = [row("1", "A"), row("2", "B")];
    expect(sortSearchResults(input, "relevance")).toBe(input);
  });
});
