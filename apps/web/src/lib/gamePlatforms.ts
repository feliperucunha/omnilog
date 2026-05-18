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
