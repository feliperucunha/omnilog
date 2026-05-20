import { describe, expect, it } from "vitest";
import { streamingNamesFromWatchProviders } from "./tmdb.js";

describe("streamingNamesFromWatchProviders", () => {
  it("prefers flatrate then free for a region", () => {
    const names = streamingNamesFromWatchProviders({
      results: {
        US: {
          flatrate: [{ provider_name: "Netflix" }],
          free: [{ provider_name: "Tubi TV" }],
        },
      },
    });
    expect(names).toEqual(["Netflix", "Tubi TV"]);
  });

  it("returns null when no providers", () => {
    expect(streamingNamesFromWatchProviders({ results: { US: {} } })).toBeNull();
  });
});
