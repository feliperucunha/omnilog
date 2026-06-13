export const ANIME_MANGA_TITLE_LANGUAGES = ["original", "english"] as const;

export type AnimeMangaTitleLanguage = (typeof ANIME_MANGA_TITLE_LANGUAGES)[number];

export const DEFAULT_ANIME_MANGA_TITLE_LANGUAGE: AnimeMangaTitleLanguage = "original";

export type AnimeMangaTitleParts = {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
};

export function resolveAnimeMangaTitleLanguage(
  raw: string | null | undefined
): AnimeMangaTitleLanguage {
  return raw === "english" ? "english" : DEFAULT_ANIME_MANGA_TITLE_LANGUAGE;
}

export function pickAnimeMangaTitle(
  parts: AnimeMangaTitleParts,
  preference: AnimeMangaTitleLanguage = DEFAULT_ANIME_MANGA_TITLE_LANGUAGE
): string {
  const romaji = parts.romaji?.trim();
  const english = parts.english?.trim();
  const native = parts.native?.trim();
  if (preference === "english") {
    return english || romaji || native || "Unknown";
  }
  return native || romaji || english || "Unknown";
}

export function pickJikanAnimeMangaTitle(
  parts: {
    title?: string | null;
    title_english?: string | null;
    title_japanese?: string | null;
  },
  preference: AnimeMangaTitleLanguage = DEFAULT_ANIME_MANGA_TITLE_LANGUAGE
): string {
  return pickAnimeMangaTitle(
    {
      romaji: parts.title,
      english: parts.title_english,
      native: parts.title_japanese,
    },
    preference
  );
}
