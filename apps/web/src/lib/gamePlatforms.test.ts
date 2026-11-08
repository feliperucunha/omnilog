import { beforeEach, describe, expect, it } from "vitest";
import {
  buildGamePlatformSelectOptions,
  getLastGamePlatform,
  rememberGamePlatform,
} from "./gamePlatforms";

describe("game platforms", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("remembers the last selected platform", () => {
    rememberGamePlatform("PlayStation 5");

    expect(getLastGamePlatform()).toBe("PlayStation 5");
  });

  it("clears the remembered platform when selecting none", () => {
    rememberGamePlatform("PC");
    rememberGamePlatform("");

    expect(getLastGamePlatform()).toBe("");
  });

  it("keeps a remembered platform that is not a default option", () => {
    const options = buildGamePlatformSelectOptions(null, "Atari Jaguar");

    expect(options.map((option) => option.value)).toContain("Atari Jaguar");
  });
});
