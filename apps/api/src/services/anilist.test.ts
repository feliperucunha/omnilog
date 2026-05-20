import { describe, expect, it } from "vitest";
import { pickAnilistDisplayTitle } from "./anilist.js";

describe("pickAnilistDisplayTitle", () => {
  const title = {
    romaji: "Kimetsu no Yaiba",
    english: "Demon Slayer: Kimetsu no Yaiba",
    native: "鬼滅の刃",
  };

  it("prefers English for Latin queries", () => {
    expect(pickAnilistDisplayTitle(title, "demon slayer")).toBe("Demon Slayer: Kimetsu no Yaiba");
  });

  it("prefers native for Japanese queries", () => {
    expect(pickAnilistDisplayTitle(title, "鬼滅")).toBe("鬼滅の刃");
  });

  it("falls back to romaji when English is missing", () => {
    expect(pickAnilistDisplayTitle({ romaji: "Test Anime", english: null, native: null }, "test")).toBe(
      "Test Anime"
    );
  });
});
