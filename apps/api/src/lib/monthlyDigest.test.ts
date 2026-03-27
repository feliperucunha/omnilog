import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDigestMonthLabel } from "./digestI18n.js";
import {
  digestPeriodKey,
  getPreviousCalendarMonthUtc,
  isMonthlyDigestAutoEnabled,
  MONTHLY_DIGEST_AUTO_DEFAULT,
} from "./monthlyDigest.js";

describe("getPreviousCalendarMonthUtc", () => {
  it("returns February when now is March 15, 2025 UTC", () => {
    const now = new Date(Date.UTC(2025, 2, 15, 12, 0, 0));
    const p = getPreviousCalendarMonthUtc(now);
    expect(p.start.toISOString()).toBe("2025-02-01T00:00:00.000Z");
    expect(p.endExclusive.toISOString()).toBe("2025-03-01T00:00:00.000Z");
    const label = formatDigestMonthLabel(p.start, "en");
    expect(label).toContain("February");
    expect(label).toContain("2025");
  });

  it("returns December of prior year when now is January", () => {
    const now = new Date(Date.UTC(2026, 0, 5, 0, 0, 0));
    const p = getPreviousCalendarMonthUtc(now);
    expect(p.start.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(p.endExclusive.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("digestPeriodKey matches UTC month of period start", () => {
    const p = getPreviousCalendarMonthUtc(new Date(Date.UTC(2025, 2, 15, 12, 0, 0)));
    expect(digestPeriodKey(p)).toBe("2025-02");
  });
});

describe("isMonthlyDigestAutoEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to on when MONTHLY_DIGEST_AUTO is unset", () => {
    vi.unstubAllEnvs();
    expect(MONTHLY_DIGEST_AUTO_DEFAULT).toBe(true);
    delete process.env.MONTHLY_DIGEST_AUTO;
    expect(isMonthlyDigestAutoEnabled()).toBe(true);
  });

  it("respects false / 0 / no", () => {
    vi.stubEnv("MONTHLY_DIGEST_AUTO", "false");
    expect(isMonthlyDigestAutoEnabled()).toBe(false);
    vi.stubEnv("MONTHLY_DIGEST_AUTO", "0");
    expect(isMonthlyDigestAutoEnabled()).toBe(false);
    vi.stubEnv("MONTHLY_DIGEST_AUTO", "no");
    expect(isMonthlyDigestAutoEnabled()).toBe(false);
  });

  it("respects true / 1 / yes", () => {
    vi.stubEnv("MONTHLY_DIGEST_AUTO", "true");
    expect(isMonthlyDigestAutoEnabled()).toBe(true);
    vi.stubEnv("MONTHLY_DIGEST_AUTO", "yes");
    expect(isMonthlyDigestAutoEnabled()).toBe(true);
  });
});
