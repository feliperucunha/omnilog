import { STATUS_I18N_KEYS } from "@logeverything/shared";
import type { MediaType } from "@logeverything/shared";

const VIDEO_MEDIA_TYPES: MediaType[] = ["movies", "tv", "anime"];

/**
 * Returns the translated status label. For Portuguese (and locale consistency),
 * "completed" is shown as "Assistido" (completedForVideo) when the media type
 * is movies, TV, or anime.
 */
export function getStatusLabel(
  t: (key: string) => string,
  status: string | null | undefined,
  mediaType?: MediaType | null
): string {
  if (!status) return "";
  const key = STATUS_I18N_KEYS[status] ?? status;
  if (
    status === "completed" &&
    mediaType &&
    VIDEO_MEDIA_TYPES.includes(mediaType)
  ) {
    return t("status.completedForVideo");
  }
  return t(`status.${key}`);
}
