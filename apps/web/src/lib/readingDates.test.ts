import { afterEach, describe, expect, it, vi } from "vitest";
import { applyBookStatusPagesChange, applyStatusAutoDates } from "./readingDates";

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

describe("applyStatusAutoDates", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fills the start date when TV or anime starts watching", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 5, 12));
    const setStartedAt = vi.fn();
    const setCompletedAt = vi.fn();

    applyStatusAutoDates("watching", "completed", setStartedAt, setCompletedAt);

    expect(setStartedAt).toHaveBeenCalledWith("2026-11-05");
    expect(setCompletedAt).not.toHaveBeenCalled();
  });

  it("fills the finish date when TV or anime is completed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 5, 12));
    const setStartedAt = vi.fn();
    const setCompletedAt = vi.fn();

    applyStatusAutoDates("completed", "watching", setStartedAt, setCompletedAt);

    expect(setStartedAt).not.toHaveBeenCalled();
    expect(setCompletedAt).toHaveBeenCalledWith("2026-11-05");
  });
});
