import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("RAWG to IGDB fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses IGDB when RAWG is unavailable", async () => {
    vi.stubEnv("RAWG_API_KEY", "rawg-key");
    vi.stubEnv("IGDB_CLIENT_ID", "client-id");
    vi.stubEnv("IGDB_CLIENT_SECRET", "client-secret");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.rawg.io/")) return new Response("", { status: 503 });
      if (url.startsWith("https://id.twitch.tv/oauth2/token")) {
        return jsonResponse({ access_token: "igdb-token", expires_in: 3600 });
      }
      if (url === "https://api.igdb.com/v4/games") {
        return jsonResponse([
          {
            id: 1025,
            name: "The Legend of Zelda",
            first_release_date: Date.UTC(2023, 4, 12) / 1000,
            cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/abc.jpg" },
            genres: [{ name: "Adventure" }],
            rating: 90,
          },
        ]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { searchGames } = await import("./rawg.js");
    const out = await searchGames("zelda");

    expect("requiresApiKey" in out).toBe(false);
    if ("requiresApiKey" in out) return;
    expect(out.results[0]).toMatchObject({
      id: "igdb:1025",
      title: "The Legend of Zelda",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.igdb.com/v4/games"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Client-ID": "client-id",
          Authorization: "Bearer igdb-token",
        }),
      })
    );
  });

  it("uses IGDB directly when no RAWG key is configured", async () => {
    vi.stubEnv("RAWG_API_KEY", "");
    vi.stubEnv("IGDB_CLIENT_ID", "client-id");
    vi.stubEnv("IGDB_ACCESS_TOKEN", "direct-token");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://api.igdb.com/v4/games") {
        return jsonResponse([{ id: 2, name: "Halo", rating: 85 }]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { searchGames } = await import("./rawg.js");
    const out = await searchGames("halo");

    expect("requiresApiKey" in out).toBe(false);
    if ("requiresApiKey" in out) return;
    expect(out.results[0]).toMatchObject({ id: "igdb:2", title: "Halo" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
