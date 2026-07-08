import { describe, expect, it } from "vitest";
import { boardGameAverageWeightFromAffinity, parseBoardGameWeightValue } from "./boardGameWeight.js";

describe("parseBoardGameWeightValue", () => {
  it("accepts valid 1–5 numbers", () => {
    expect(parseBoardGameWeightValue(3.2)).toBe(3.2);
    expect(parseBoardGameWeightValue("2,5")).toBe(2.5);
  });

  it("rejects out of range or invalid", () => {
    expect(parseBoardGameWeightValue(0)).toBeNull();
    expect(parseBoardGameWeightValue(6)).toBeNull();
    expect(parseBoardGameWeightValue("")).toBeNull();
  });
});

describe("boardGameAverageWeightFromAffinity", () => {
  it("reads boardgames.averageWeight", () => {
    expect(
      boardGameAverageWeightFromAffinity({ boardgames: { averageWeight: 4.1 } })
    ).toBe(4.1);
  });
});
