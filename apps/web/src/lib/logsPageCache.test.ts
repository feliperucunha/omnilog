import { describe, expect, it } from "vitest";
import { normalizeLogsListResponse } from "@/lib/logsPageCache";
import type { Log } from "@geeklogs/shared";

const sampleLog = { id: "1", externalId: "abc", mediaType: "movies" } as Log;

describe("normalizeLogsListResponse", () => {
  it("unwraps paginated responses", () => {
    expect(
      normalizeLogsListResponse({ data: [sampleLog], nextCursor: "cursor-1" })
    ).toEqual({ logs: [sampleLog], nextCursor: "cursor-1" });
  });

  it("passes through legacy array responses", () => {
    expect(normalizeLogsListResponse([sampleLog])).toEqual({
      logs: [sampleLog],
      nextCursor: null,
    });
  });
});
