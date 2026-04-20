import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "@geeklogs/shared";

describe("decodeHtmlEntities", () => {
  it("decodes numeric apostrophe", () => {
    expect(decodeHtmlEntities("Tom&#039;s")).toBe("Tom's");
  });

  it("decodes after named amp", () => {
    expect(decodeHtmlEntities("Tom&amp;#039;s")).toBe("Tom's");
  });

  it("decodes hex and named", () => {
    expect(decodeHtmlEntities("a&#x27;b &amp; c")).toBe("a'b & c");
  });

  it("handles nullish", () => {
    expect(decodeHtmlEntities(null)).toBe("");
    expect(decodeHtmlEntities(undefined)).toBe("");
  });
});
