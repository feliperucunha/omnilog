import { DISCOVER_TASTE_VERSION } from "@geeklogs/shared";
import { describe, expect, it } from "vitest";
import {
  buildDiscoverTastePrompt,
  parseDiscoverTasteResponse,
  parseStoredDiscoverTasteSnapshot,
} from "./discoverTaste.js";

describe("discoverTaste", () => {
  it("builds a prompt with the supplied categories", () => {
    const prompt = buildDiscoverTastePrompt({
      locale: "pt-BR",
      categories: [
        {
          mediaType: "movies",
          summary: { count: 1, meanGrade: "9.0" },
          logs: [{ title: "Arrival", grade: 9, status: "watched" }],
          candidates: [{ id: "tt1160419", title: "Dune", genres: ["Sci-Fi"] }],
        },
      ],
    });

    expect(prompt).toContain("pt-BR");
    expect(prompt).toContain("Arrival");
    expect(prompt).toContain("Dune");
  });

  it("parses and filters AI taste results", () => {
    const response = parseDiscoverTasteResponse(
      JSON.stringify({
        movies: {
          lines: ["You like thoughtful science fiction."],
          beyond: [
            { id: "tt1160419", title: "Dune", note: "Matches your interest in epic sci-fi." },
            { id: "unknown", title: "Invented", note: "Should be removed." },
          ],
        },
      }),
      ["movies"],
      { movies: new Set(["tt1160419"]) }
    );

    expect(response.movies?.lines).toEqual(["You like thoughtful science fiction."]);
    expect(response.movies?.beyond).toEqual([
      { id: "tt1160419", title: "Dune", note: "Matches your interest in epic sci-fi." },
    ]);
  });

  it("rejects invalid AI JSON", () => {
    expect(() => parseDiscoverTasteResponse("not json", ["movies"], {})).toThrow();
  });

  it("invalidates stored snapshots from older versions", () => {
    const categories = {
      movies: { lines: ["You like thoughtful science fiction."], charts: [], planned: [], beyond: [] },
    };

    expect(
      parseStoredDiscoverTasteSnapshot({
        version: DISCOVER_TASTE_VERSION - 1,
        refreshedAt: null,
        categories,
      })
    ).toBeNull();
    expect(
      parseStoredDiscoverTasteSnapshot({
        version: DISCOVER_TASTE_VERSION,
        refreshedAt: null,
        categories,
      })?.categories.movies?.lines
    ).toEqual(["You like thoughtful science fiction."]);
  });
});
