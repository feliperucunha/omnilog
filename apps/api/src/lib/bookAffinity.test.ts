import { describe, expect, it } from "vitest";
import { buildBookTagAffinityMaps } from "./bookAffinity.js";

describe("buildBookTagAffinityMaps", () => {
  it("merges genres, subjects, and authors", () => {
    const ctx = JSON.stringify({
      books: { subjects: ["Science Fiction"], authors: ["Ursula K. Le Guin"] },
    });
    const { scores, queryLabel } = buildBookTagAffinityMaps([
      { genres: JSON.stringify(["Fiction"]), affinityContext: ctx, grade: 9, status: "completed" },
    ]);
    expect(scores.get("science fiction")).toBeGreaterThan(0);
    expect(scores.get("fiction")).toBeGreaterThan(0);
    expect(scores.get("ursula k. le guin")).toBeGreaterThan(0);
    expect(queryLabel.get("ursula k. le guin")).toContain("Le Guin");
  });
});
