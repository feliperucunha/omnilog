import { describe, expect, it } from "vitest";
import { buildTagAffinityMaps, pickAffinitySearchQueries } from "./boardGameAffinity.js";

const emptyCtx = { affinityContext: null as string | null };

describe("buildTagAffinityMaps", () => {
  it("adds weight for high grades and uses categories + mechanics", () => {
    const { scores, queryLabel } = buildTagAffinityMaps([
      {
        genres: JSON.stringify(["Strategy Games", "Card Game"]),
        mechanics: JSON.stringify(["Hand Management"]),
        grade: 10,
        status: "played",
        ...emptyCtx,
      },
    ]);
    expect(scores.get("strategy games")).toBeGreaterThan(0);
    expect(scores.get("card game")).toBeGreaterThan(0);
    expect(scores.get("hand management")).toBeGreaterThan(0);
    expect(queryLabel.get("strategy games")).toBe("Strategy Games");
  });

  it("subtracts affinity for very low grades", () => {
    const { scores } = buildTagAffinityMaps([
      {
        genres: JSON.stringify(["Party Game"]),
        mechanics: null,
        grade: 1,
        status: "played",
        ...emptyCtx,
      },
    ]);
    expect(scores.get("party game") ?? 0).toBeLessThan(0);
  });

  it("nudges heavy/long-game BGG profiles toward strategy-style tags", () => {
    const ctx = JSON.stringify({
      boardgames: { averageWeight: 4.2, playingTimeMinutes: 180, playersMin: 2, playersMax: 4 },
    });
    const { scores } = buildTagAffinityMaps([
      {
        genres: JSON.stringify(["Strategy Games"]),
        mechanics: null,
        grade: 8,
        status: "played",
        affinityContext: ctx,
      },
    ]);
    expect((scores.get("economic") ?? 0) + (scores.get("wargame") ?? 0)).toBeGreaterThan(0.3);
  });
});

describe("pickAffinitySearchQueries", () => {
  it("returns top positive tags as search strings", () => {
    const scores = new Map<string, number>([
      ["euro", 2],
      ["dexterity", 0.5],
      ["ignored", -1],
    ]);
    const queryLabel = new Map<string, string>([
      ["euro", "Eurogame"],
      ["dexterity", "Dexterity"],
    ]);
    const q = pickAffinitySearchQueries(scores, queryLabel, 3);
    expect(q).toEqual(["Eurogame", "Dexterity"]);
  });
});
