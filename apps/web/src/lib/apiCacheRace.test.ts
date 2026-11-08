import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./persistClientCache.js", () => ({
  loadPersistedGetCache: vi.fn().mockResolvedValue([]),
  schedulePersistGetEntry: vi.fn(),
  scheduleDeletePersistedKeysMatching: vi.fn(),
}));

import { apiFetchCached, getCachedEntry, invalidateApiCache } from "./api";

describe("api cache invalidation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not cache a GET response that started before a mutation", async () => {
    const path = `/logs?race-test=${Date.now()}-${Math.random()}`;
    let resolveFetch!: (response: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pendingResponse));

    const request = apiFetchCached<{ value: string }>(path, { maxAttempts: 1 });
    invalidateApiCache("/logs?");

    resolveFetch(
      new Response(JSON.stringify({ value: "before-save" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(request).resolves.toEqual({ value: "before-save" });
    expect(getCachedEntry("GET", path)).toBeUndefined();
  });
});
