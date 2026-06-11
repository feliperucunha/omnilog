export type GamePlatformFamily = "nintendo" | "sony" | "xbox" | "pc" | "other";

export function getGamePlatformFamily(platform: string): GamePlatformFamily {
  const n = platform.trim().toLowerCase();
  if (!n) return "other";

  if (
    n.includes("nintendo") ||
    n.includes("wii") ||
    n.includes("switch") ||
    n.includes("gamecube") ||
    n.includes("game boy") ||
    n.includes("gameboy") ||
    n.includes("3ds") ||
    /\b(snes|nes|n64)\b/.test(n) ||
    n.includes("nintendo 64")
  ) {
    return "nintendo";
  }

  if (
    n.includes("playstation") ||
    n.includes("ps vita") ||
    n.includes("psvita") ||
    /\bpsp\b/.test(n) ||
    n.includes("sony")
  ) {
    return "sony";
  }

  if (n.includes("xbox")) {
    return "xbox";
  }

  if (
    n === "pc" ||
    n.includes("mac") ||
    n.includes("linux") ||
    n.includes("windows") ||
    n.includes("steam deck") ||
    n.includes("steam os")
  ) {
    return "pc";
  }

  return "other";
}

export function getGamePlatformBadgeClass(family: GamePlatformFamily): string {
  switch (family) {
    case "nintendo":
      return "bg-red-600 text-white border-red-500/70";
    case "sony":
      return "bg-blue-600 text-white border-blue-500/70";
    case "xbox":
      return "bg-green-600 text-white border-green-500/70";
    case "pc":
      return "bg-white text-black border-[var(--color-mid)]/60 dark:bg-zinc-100 dark:text-zinc-950";
    default:
      return "bg-[var(--color-mid)]/50 text-[var(--color-lightest)] border-[var(--color-mid)]/40";
  }
}

export function getGamePlatformBarFillClass(family: GamePlatformFamily): string {
  switch (family) {
    case "nintendo":
      return "bg-red-600";
    case "sony":
      return "bg-blue-600";
    case "xbox":
      return "bg-green-600";
    case "pc":
      return "bg-zinc-200 dark:bg-zinc-100";
    default:
      return "bg-[var(--color-mid)]";
  }
}

/** Common platforms for game logs (scrollable select). */
export const POPULAR_GAME_PLATFORMS = [
  "PC",
  "PlayStation 5",
  "PlayStation 4",
  "PlayStation 3",
  "PlayStation 2",
  "PlayStation",
  "Xbox Series X|S",
  "Xbox One",
  "Xbox 360",
  "Xbox",
  "Nintendo Switch",
  "Nintendo Switch 2",
  "Wii U",
  "Wii",
  "GameCube",
  "Nintendo 3DS",
  "Nintendo DS",
  "Game Boy Advance",
  "PlayStation Vita",
  "PSP",
  "iOS",
  "Android",
  "Mac",
  "Steam Deck",
  "Meta Quest",
  "SNES",
  "NES",
  "Nintendo 64",
  "Sega Genesis",
  "Sega Dreamcast",
  "Sega Saturn",
] as const;

export function buildGamePlatformSelectOptions(
  extras: string[] | null | undefined,
  currentValue: string
): { value: string; label: string }[] {
  const popular = new Set<string>(POPULAR_GAME_PLATFORMS);
  const extraSorted = [...new Set((extras ?? []).filter(Boolean))]
    .filter((p) => !popular.has(p))
    .sort((a, b) => a.localeCompare(b));
  const current = currentValue.trim();
  if (current && !popular.has(current) && !extraSorted.includes(current)) {
    extraSorted.push(current);
    extraSorted.sort((a, b) => a.localeCompare(b));
  }

  return [
    { value: "", label: "—" },
    ...POPULAR_GAME_PLATFORMS.map((p) => ({ value: p, label: p })),
    ...extraSorted.map((p) => ({ value: p, label: p })),
  ];
}
