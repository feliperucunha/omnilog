import { describe, expect, it } from "vitest";
import { minorToAmountString, parseAmountToMinor } from "@/lib/moneyInput";
import {
  popFractionDigit,
  popMajorDigit,
  pushFractionDigit,
  pushMajorDigit,
} from "@/lib/moneyInputEdit";

describe("money input edit", () => {
  it("types integer digits with live BRL formatting", () => {
    let minor: number | null = null;
    minor = pushMajorDigit(minor, 1, 2);
    expect(minorToAmountString(minor, "BRL")).toBe("1,00");
    minor = pushMajorDigit(minor, 2, 2);
    expect(minorToAmountString(minor, "BRL")).toBe("12,00");
    minor = popMajorDigit(minor, 2);
    expect(minorToAmountString(minor, "BRL")).toBe("1,00");
    minor = popMajorDigit(minor, 2);
    expect(minor).toBeNull();
  });

  it("types integer digits with live USD formatting", () => {
    let minor: number | null = null;
    minor = pushMajorDigit(minor, 1, 2);
    expect(minorToAmountString(minor, "USD")).toBe("1.00");
    minor = pushMajorDigit(minor, 5, 2);
    expect(minorToAmountString(minor, "USD")).toBe("15.00");
  });

  it("enters fractional digits after decimal separator", () => {
    let minor: number | null = pushMajorDigit(null, 1, 2);
    minor = pushFractionDigit(minor, 5, 2);
    expect(minorToAmountString(minor, "BRL")).toBe("1,05");
    minor = pushFractionDigit(minor, 0, 2);
    expect(minorToAmountString(minor, "BRL")).toBe("1,50");
    minor = popFractionDigit(minor, 2);
    expect(minor).not.toBeNull();
    expect(minorToAmountString(minor, "BRL")).toBe("1,05");
  });
});

describe("parseAmountToMinor", () => {
  it("parses formatted BRL and USD values", () => {
    expect(parseAmountToMinor("1,00", "BRL")).toBe(100);
    expect(parseAmountToMinor("1,50", "BRL")).toBe(150);
    expect(parseAmountToMinor("1.234,56", "BRL")).toBe(123456);
    expect(parseAmountToMinor("1.00", "USD")).toBe(100);
    expect(parseAmountToMinor("1,234.56", "USD")).toBe(123456);
  });
});

describe("minorToAmountString", () => {
  it("uses currency locale separators", () => {
    expect(minorToAmountString(100, "BRL")).toBe("1,00");
    expect(minorToAmountString(100, "USD")).toBe("1.00");
  });
});
