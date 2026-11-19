import { afterEach, describe, expect, it } from "vitest";
import { resolveGroqModel } from "./groq.js";

describe("groq", () => {
  afterEach(() => {
    delete process.env.GROQ_MODEL;
  });

  it("uses the default model when no override is set", () => {
    expect(resolveGroqModel()).toBe("qwen/qwen3.8-27b");
  });

  it("normalizes models/ prefixes", () => {
    process.env.GROQ_MODEL = "models/qwen/qwen3.8-27b";
    expect(resolveGroqModel()).toBe("qwen/qwen3.8-27b");
  });
});
