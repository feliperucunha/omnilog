import { describe, expect, it } from "vitest";
import { kitsuCollectionToSearchResults, type KitsuCollectionResponse } from "./kitsu.js";

describe("kitsuCollectionToSearchResults", () => {
  const payload: KitsuCollectionResponse = {
    data: [
      {
        id: "11",
        attributes: {
          nsfw: false,
          canonicalTitle: "Naruto",
          titles: { en: "Naruto", en_jp: "Naruto", ja_jp: "ナルト" },
          startDate: "2002-10-03",
          averageRating: "80.21",
          posterImage: { small: "https://example.com/naruto.jpg" },
        },
        relationships: {
          mappings: { data: [{ type: "mappings", id: "mal-1" }] },
        },
      },
      {
        id: "nsfw",
        attributes: { nsfw: true, canonicalTitle: "Skip me" },
        relationships: {
          mappings: { data: [{ type: "mappings", id: "mal-2" }] },
        },
      },
    ],
    included: [
      {
        id: "mal-1",
        type: "mappings",
        attributes: { externalSite: "myanimelist/anime", externalId: "20" },
      },
      {
        id: "mal-2",
        type: "mappings",
        attributes: { externalSite: "myanimelist/anime", externalId: "999" },
      },
    ],
  };

  it("maps Kitsu rows to MAL ids and skips nsfw", () => {
    const rows = kitsuCollectionToSearchResults(payload, "anime", "english");
    expect(rows).toEqual([
      {
        id: "20",
        title: "Naruto",
        image: "https://example.com/naruto.jpg",
        year: "2002",
        subtitle: null,
        score: 8.02,
      },
    ]);
  });

  it("skips rows without a MAL mapping", () => {
    const rows = kitsuCollectionToSearchResults(
      {
        data: [{ id: "1", attributes: { canonicalTitle: "No mapping" } }],
        included: [],
      },
      "manga"
    );
    expect(rows).toEqual([]);
  });
});
