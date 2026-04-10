import { describe, expect, it } from "vitest";
import { computeGenreFacets, logHasGenreExact } from "./logGenreList.js";

describe("computeGenreFacets", () => {
  it("counts each log once per genre and sorts by count desc", () => {
    const rows = [
      { id: "a", genres: '["Action","Drama"]' },
      { id: "b", genres: '["Action"]' },
      { id: "c", genres: '["Drama"]' },
    ];
    const out = computeGenreFacets(rows);
    expect(out.find((x) => x.name === "Action")).toEqual({ name: "Action", count: 2 });
    expect(out.find((x) => x.name === "Drama")).toEqual({ name: "Drama", count: 2 });
  });
});

describe("logHasGenreExact", () => {
  it("matches trimmed genre labels", () => {
    expect(logHasGenreExact({ genres: '["Sci-Fi"]' }, "Sci-Fi")).toBe(true);
    expect(logHasGenreExact({ genres: '["Sci-Fi"]' }, "Action")).toBe(false);
  });
});
