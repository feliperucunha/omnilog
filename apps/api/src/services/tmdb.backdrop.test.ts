import { describe, expect, it } from "vitest";
import { tmdbBackdropUrl } from "./tmdb.js";

describe("tmdbBackdropUrl", () => {
  it("builds a wide backdrop and ignores a missing path", () => {
    expect(tmdbBackdropUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w1280/abc.jpg");
    expect(tmdbBackdropUrl("abc.jpg")).toBe("https://image.tmdb.org/t/p/w1280/abc.jpg");
    expect(tmdbBackdropUrl(null)).toBeNull();
    expect(tmdbBackdropUrl("  ")).toBeNull();
  });
});
