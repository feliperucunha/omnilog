import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./persistClientCache.js", () => ({
  loadPersistedGetCache: vi.fn().mockResolvedValue([]),
  schedulePersistGetEntry: vi.fn(),
  scheduleDeletePersistedKeysMatching: vi.fn(),
}));

import { getCachedEntry, markStaleByPrefix, setCached, updateCachedEntriesMatching } from "./cache";
import { schedulePersistGetEntry } from "./persistClientCache.js";

const persist = vi.mocked(schedulePersistGetEntry);

function uniquePath(label: string): string {
  return `/logs?cache-test=${label}-${Date.now()}-${Math.random()}`;
}

describe("client GET cache persistence", () => {
  beforeEach(() => {
    persist.mockClear();
  });

  it("persists entries updated after a log save", () => {
    const path = uniquePath("update");
    setCached("GET", path, { data: [{ id: "1", title: "Before" }], nextCursor: null }, 30_000);
    persist.mockClear();

    updateCachedEntriesMatching(
      "GET /logs?",
      (data) => {
        const payload = data as { data: Array<{ id: string; title: string }>; nextCursor: null };
        return {
          ...payload,
          data: payload.data.map((log) => (log.id === "1" ? { ...log, title: "After" } : log)),
        };
      },
      30_000
    );

    expect(getCachedEntry<{ data: Array<{ title: string }> }>("GET", path)?.data.data[0]?.title).toBe(
      "After"
    );
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        key: `GET ${path}`,
        data: { data: [{ id: "1", title: "After" }], nextCursor: null },
      })
    );
  });

  it("persists stale markers so reloads revalidate mutated data", () => {
    const path = uniquePath("stale");
    setCached("GET", path, { data: [], nextCursor: null }, 30 * 60_000);
    persist.mockClear();

    markStaleByPrefix(path);

    expect(getCachedEntry("GET", path)?.isStale).toBe(true);
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        key: `GET ${path}`,
        expiresAt: expect.any(Number),
      })
    );
  });
});
