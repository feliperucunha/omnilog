import { describe, expect, it } from "vitest";
import { getHeroImageUrl, getItemHeaderImageUrl } from "./getHeroImageUrl";

describe("getItemHeaderImageUrl", () => {
  it("keeps a wide TMDB cover and falls back to the card", () => {
    const cover = "https://image.tmdb.org/t/p/w1280/backdrop.jpg";
    const card = "https://image.tmdb.org/t/p/w200/poster.jpg";
    expect(getHeroImageUrl(cover)).toBe(cover);
    expect(getHeroImageUrl(card)).toBe("https://image.tmdb.org/t/p/w780/poster.jpg");
    expect(getItemHeaderImageUrl(cover, card, null)).toBe(cover);
    expect(getItemHeaderImageUrl(null, card, null)).toBe("https://image.tmdb.org/t/p/w780/poster.jpg");
    expect(getItemHeaderImageUrl(cover, card, null, true)).toBe("https://image.tmdb.org/t/p/w780/poster.jpg");
    expect(getItemHeaderImageUrl(null, null, "https://example.com/thumb.jpg")).toBe("https://example.com/thumb.jpg");
  });
});
