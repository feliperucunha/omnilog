import { describe, expect, it } from "vitest";
import { combineAbortSignals, isAbortError, isCallerAborted } from "@/lib/abortUtils";
import { shouldPersistCacheKey } from "@/lib/persistClientCache";
import { shouldUseLowPriorityLane } from "@/lib/fetchQueue";
import { buildLogsIndexPath } from "@/lib/logsPageCache";

describe("abortUtils", () => {
  it("treats caller-aborted fetches as non-timeout aborts", () => {
    const controller = new AbortController();
    controller.abort();
    const err = new DOMException("The operation was aborted.", "AbortError");
    expect(isAbortError(err)).toBe(true);
    expect(isCallerAborted(controller.signal, err)).toBe(true);
    expect(isCallerAborted(undefined, err)).toBe(false);
  });

  it("combines already-aborted signals", () => {
    const controller = new AbortController();
    controller.abort();
    const combined = combineAbortSignals([controller.signal, new AbortController().signal]);
    expect(combined.aborted).toBe(true);
  });
});

describe("persistClientCache", () => {
  it("persists search, me, and log index keys", () => {
    expect(shouldPersistCacheKey("GET /me")).toBe(true);
    expect(shouldPersistCacheKey("GET /search/browse?type=movies")).toBe(true);
    expect(shouldPersistCacheKey("GET /logs/index?mediaType=tv")).toBe(true);
    expect(shouldPersistCacheKey("GET /follows")).toBe(false);
  });
});

describe("fetchQueue", () => {
  it("sends prefetch through the low-priority lane", () => {
    expect(shouldUseLowPriorityLane("low")).toBe(true);
    expect(shouldUseLowPriorityLane("high")).toBe(false);
    expect(shouldUseLowPriorityLane(undefined)).toBe(false);
  });
});

describe("buildLogsIndexPath", () => {
  it("scopes the slim index to a media type", () => {
    expect(buildLogsIndexPath("movies")).toBe("/logs/index?mediaType=movies");
  });
});
