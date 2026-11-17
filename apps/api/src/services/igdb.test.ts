import { describe, expect, it } from "vitest";
import {
  buildIgdbSearchQuery,
  igdbCoverUrl,
  isIgdbExternalId,
  mapIgdbGameToItemDetail,
  mapIgdbGameToSearchResult,
  parseIgdbExternalId,
  toIgdbExternalId,
} from "./igdb.js";

describe("IGDB external IDs", () => {
  it("namespaces and parses game IDs", () => {
    expect(toIgdbExternalId(1025)).toBe("igdb:1025");
    expect(parseIgdbExternalId("igdb:1025")).toBe(1025);
    expect(isIgdbExternalId("igdb:1025")).toBe(true);
    expect(isIgdbExternalId("1025")).toBe(false);
    expect(isIgdbExternalId("igdb:abc")).toBe(false);
  });
});

describe("IGDB search query", () => {
  it("escapes relevance search terms", () => {
    expect(buildIgdbSearchQuery('Halo "3"')).toContain('search "Halo \\"3\\""');
  });

  it("uses name filtering when sorting because IGDB rejects search with sort", () => {
    const query = buildIgdbSearchQuery("zelda", "released_desc");
    expect(query).not.toContain("search ");
    expect(query).toContain('where name ~ *"zelda"* & version_parent = null');
    expect(query).toContain("sort first_release_date desc");
    expect(buildIgdbSearchQuery("zelda", "name_asc")).toContain("sort name asc");
  });
});

describe("mapIgdbGameToSearchResult", () => {
  it("maps list rows to catalog search results", () => {
    const result = mapIgdbGameToSearchResult({
      id: 1025,
      name: "The Legend of Zelda &amp; Link",
      first_release_date: Date.UTC(2023, 4, 12) / 1000,
      cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/abc.jpg" },
      genres: [{ name: "Adventure" }, { name: "Adventure" }, { name: "RPG" }],
      rating: 88,
    });

    expect(result).toMatchObject({
      id: "igdb:1025",
      title: "The Legend of Zelda & Link",
      image: "https://images.igdb.com/igdb/image/upload/t_cover_big/abc.jpg",
      year: "2023",
      genres: ["Adventure", "RPG"],
      score: 4.4,
    });
  });
});

describe("mapIgdbGameToItemDetail", () => {
  it("maps detail rows including companies, tags, score and time to beat", () => {
    const detail = mapIgdbGameToItemDetail(
      {
        id: 1025,
        name: "The Legend of Zelda",
        first_release_date: Date.UTC(2023, 4, 12) / 1000,
        cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/abc.jpg" },
        genres: [{ name: "Adventure" }],
        platforms: [{ name: "Nintendo Switch" }],
        involved_companies: [
          { developer: true, publisher: false, company: { name: "Nintendo EPD" } },
          { developer: false, publisher: true, company: { name: "Nintendo" } },
        ],
        themes: [{ name: "Action" }],
        keywords: [{ name: "Fantasy" }],
        summary: "A grand adventure.",
        total_rating: 91,
      },
      { game_id: 1025, normally: 120_000 }
    );

    expect(detail).toMatchObject({
      id: "igdb:1025",
      title: "The Legend of Zelda",
      releaseDate: "2023-05-12",
      description: "A grand adventure.",
      score: 9.1,
      timeToBeatHours: 33.3,
      platforms: ["Nintendo Switch"],
      developers: ["Nintendo EPD"],
      publishers: ["Nintendo"],
      tags: ["Action", "Fantasy"],
      cover: null,
    });
  });

  it("uses key art for the header cover and keeps box art as the card", () => {
    const detail = mapIgdbGameToItemDetail({
      id: 1,
      name: "Halo",
      cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/box.jpg" },
      artworks: [{ image_id: "art1" }],
      screenshots: [{ image_id: "shot1" }],
    });
    expect(detail.image).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/box.jpg");
    expect(detail.cover).toBe("https://images.igdb.com/igdb/image/upload/t_1080p/art1.jpg");
    expect(igdbCoverUrl({ screenshots: [{ image_id: "shot1" }] })).toBe(
      "https://images.igdb.com/igdb/image/upload/t_1080p/shot1.jpg"
    );
  });
});
