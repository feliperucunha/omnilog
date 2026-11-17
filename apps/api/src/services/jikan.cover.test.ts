import { describe, expect, it } from "vitest";
import { jikanTrailerCoverUrl } from "./jikan.js";

describe("jikanTrailerCoverUrl", () => {
  it("prefers the reliable trailer still and skips an empty trailer", () => {
    expect(
      jikanTrailerCoverUrl({
        large_image_url: "https://img.youtube.com/vi/abc/hqdefault.jpg",
        maximum_image_url: "https://img.youtube.com/vi/abc/maxresdefault.jpg",
      })
    ).toBe("https://img.youtube.com/vi/abc/hqdefault.jpg");
    expect(jikanTrailerCoverUrl({ maximum_image_url: " https://img.youtube.com/vi/abc/maxresdefault.jpg " })).toBe(
      "https://img.youtube.com/vi/abc/maxresdefault.jpg"
    );
    expect(jikanTrailerCoverUrl(null)).toBeNull();
    expect(jikanTrailerCoverUrl({})).toBeNull();
  });
});
