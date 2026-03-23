import { describe, expect, it } from "vitest";
import { bggExtractImageUrl } from "./bgg.js";

describe("bggExtractImageUrl", () => {
  it("returns null for empty / unknown", () => {
    expect(bggExtractImageUrl(null)).toBeNull();
    expect(bggExtractImageUrl(undefined)).toBeNull();
    expect(bggExtractImageUrl("")).toBeNull();
    expect(bggExtractImageUrl("   ")).toBeNull();
    expect(bggExtractImageUrl({})).toBeNull();
  });

  it("accepts plain string URL", () => {
    expect(bggExtractImageUrl("  https://cf.geekdo-image.com/x.jpg  ")).toBe("https://cf.geekdo-image.com/x.jpg");
  });

  it("normalizes protocol-relative URLs", () => {
    expect(bggExtractImageUrl("//cf.geekdo-image.com/x.jpg")).toBe("https://cf.geekdo-image.com/x.jpg");
  });

  it("rejects non-http(s) strings so thumbnail can be tried instead", () => {
    expect(bggExtractImageUrl("/relative/path.jpg")).toBeNull();
    expect(bggExtractImageUrl("not-a-url")).toBeNull();
  });

  it("accepts fast-xml-parser object with #text and attributes", () => {
    expect(
      bggExtractImageUrl({
        "#text": "https://cf.geekdo-image.com/a.jpg",
        "@_type": "thing",
      })
    ).toBe("https://cf.geekdo-image.com/a.jpg");
  });

  it("accepts array of URLs (multiple <image> siblings)", () => {
    expect(bggExtractImageUrl(["https://a.jpg", "https://b.jpg"])).toBe("https://a.jpg");
  });

  it("accepts attribute-only image node (@_href)", () => {
    expect(bggExtractImageUrl({ "@_href": "https://cf.geekdo-image.com/z.png" })).toBe(
      "https://cf.geekdo-image.com/z.png"
    );
  });
});
