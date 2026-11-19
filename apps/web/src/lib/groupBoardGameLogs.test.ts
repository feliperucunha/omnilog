import { describe, expect, it } from "vitest";
import type { Log } from "@geeklogs/shared";
import {
  addExpansionParentPlaceholders,
  groupBoardGameLogs,
  isExpansionParentPlaceholder,
} from "./groupBoardGameLogs";

function log(overrides: Partial<Log> & { id: string; externalId: string; title: string }): Log {
  return {
    userId: "u1",
    mediaType: "boardgames",
    boardGameSource: "bgg",
    expansionOfExternalId: null,
    expansionOfTitle: null,
    ...overrides,
  } as unknown as Log;
}

describe("groupBoardGameLogs", () => {
  it("groups an expansion under a base that was appended after it", () => {
    const child = log({
      id: "child",
      externalId: "227748",
      title: "Deception: Undercover Allies",
      expansionOfExternalId: "156129",
      expansionOfTitle: "Deception: Murder in Hong Kong",
    });
    const unrelated = log({ id: "other", externalId: "1", title: "Other" });
    const base = log({ id: "base", externalId: "156129", title: "Deception: Murder in Hong Kong" });

    const grouped = groupBoardGameLogs([child, unrelated, base]);

    expect(grouped.map((group) => group.log.id)).toEqual(["base", "other"]);
    expect(grouped[0]?.children.map((entry) => entry.id)).toEqual(["child"]);
  });

  it("keeps an expansion as its own root when the base is not loaded", () => {
    const child = log({
      id: "child",
      externalId: "426129",
      title: "Dune: Imperium – Bloodlines",
      expansionOfExternalId: "397598",
    });

    const grouped = groupBoardGameLogs([child]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.log.id).toBe("child");
    expect(grouped[0]?.children).toEqual([]);
  });

  it("groups immediately with a placeholder base while the real parent is loading", () => {
    const child = log({
      id: "child",
      externalId: "227748",
      title: "Deception: Undercover Allies",
      expansionOfExternalId: "156129",
      expansionOfTitle: "Deception: Murder in Hong Kong",
    });

    const grouped = groupBoardGameLogs(addExpansionParentPlaceholders([child]));

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.log.title).toBe("Deception: Murder in Hong Kong");
    expect(isExpansionParentPlaceholder(grouped[0]!.log)).toBe(true);
    expect(grouped[0]?.children.map((entry) => entry.id)).toEqual(["child"]);
  });

  it("replaces the placeholder once the real parent is fetched", () => {
    const child = log({
      id: "child",
      externalId: "227748",
      title: "Deception: Undercover Allies",
      expansionOfExternalId: "156129",
      expansionOfTitle: "Deception: Murder in Hong Kong",
    });
    const parent = log({ id: "base", externalId: "156129", title: "Deception: Murder in Hong Kong" });

    const grouped = groupBoardGameLogs(addExpansionParentPlaceholders([child], [parent]));

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.log.id).toBe("base");
    expect(isExpansionParentPlaceholder(grouped[0]!.log)).toBe(false);
    expect(grouped[0]?.children.map((entry) => entry.id)).toEqual(["child"]);
  });

  it("groups nested expansions under the top-level base", () => {
    const base = log({ id: "base", externalId: "1", title: "Base" });
    const child = log({
      id: "child",
      externalId: "2",
      title: "Expansion",
      expansionOfExternalId: "1",
    });
    const grandchild = log({
      id: "grandchild",
      externalId: "3",
      title: "Expansion of expansion",
      expansionOfExternalId: "2",
    });

    const grouped = groupBoardGameLogs([grandchild, child, base]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.log.id).toBe("base");
    expect(grouped[0]?.children.map((entry) => entry.id)).toEqual(["grandchild", "child"]);
  });
});
