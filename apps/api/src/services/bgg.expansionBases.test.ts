import { describe, expect, it } from "vitest";
import { bggExtractExpansionBases } from "./bgg.js";

describe("bggExtractExpansionBases", () => {
  it("returns every inbound expansion base and ignores outbound links", () => {
    expect(
      bggExtractExpansionBases([
        {
          "@_type": "boardgameexpansion",
          "@_id": "316554",
          "@_value": "Dune: Imperium",
          "@_inbound": "true",
        },
        {
          "@_type": "boardgameexpansion",
          "@_id": "397598",
          "@_value": "Dune: Imperium &ndash; Uprising",
          "@_inbound": "true",
        },
        {
          "@_type": "boardgameexpansion",
          "@_id": "342031",
          "@_value": "Dune: Imperium - Rise of Ix",
        },
        {
          "@_type": "boardgamecategory",
          "@_id": "1010",
          "@_value": "Fantasy",
          "@_inbound": "true",
        },
      ])
    ).toEqual([
      { id: "316554", title: "Dune: Imperium" },
      { id: "397598", title: "Dune: Imperium – Uprising" },
    ]);
  });

  it("deduplicates repeated base ids and handles missing titles", () => {
    expect(
      bggExtractExpansionBases([
        { "@_type": "boardgameexpansion", "@_id": "1", "@_inbound": "true" },
        { "@_type": "boardgameexpansion", "@_id": "1", "@_value": "One", "@_inbound": "true" },
        { "@_type": "boardgameexpansion", "@_id": "2", "@_value": "", "@_inbound": "true" },
      ])
    ).toEqual([
      { id: "1", title: "One" },
      { id: "2", title: "Unknown" },
    ]);
  });

  it("returns an empty list when there is no inbound base", () => {
    expect(bggExtractExpansionBases([])).toEqual([]);
    expect(
      bggExtractExpansionBases([
        { "@_type": "boardgameexpansion", "@_id": "1", "@_value": "Expansion" },
      ])
    ).toEqual([]);
  });
});
