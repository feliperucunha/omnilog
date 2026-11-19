import { afterEach, describe, expect, it } from "vitest";
import { resolveGeminiModel } from "./gemini.js";

describe("gemini", () => {
  afterEach(() => {
    delete process.env.GEMINI_MODEL;
  });

  it("uses the default model when no override is set", () => {
    expect(resolveGeminiModel()).toBe("gemini-3.5-flash-lite");
  });

  it("normalizes models/ prefixes", () => {
    process.env.GEMINI_MODEL = "models/gemini-3.5-flash-lite";
    expect(resolveGeminiModel()).toBe("gemini-3.5-flash-lite");
  });
});
