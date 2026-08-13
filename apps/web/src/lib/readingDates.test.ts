import { describe, expect, it, vi } from "vitest";
import { applyBookStatusPagesChange } from "./readingDates";

describe("applyBookStatusPagesChange", () => {
  it("sets pages to edition max when status becomes read", () => {
    const setPagesRead = vi.fn();
    applyBookStatusPagesChange("read", setPagesRead, 320);
    expect(setPagesRead).toHaveBeenCalledWith(320);
  });

  it("clears pages when status is not read", () => {
    const setPagesRead = vi.fn();
    applyBookStatusPagesChange("reading", setPagesRead, 320);
    expect(setPagesRead).toHaveBeenCalledWith("");
  });

  it("does not set pages on read when edition page count is unknown", () => {
    const setPagesRead = vi.fn();
    applyBookStatusPagesChange("read", setPagesRead, null);
    expect(setPagesRead).not.toHaveBeenCalled();
  });
});
