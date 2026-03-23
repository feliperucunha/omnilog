import { toast } from "sonner";
import type { MediaType } from "@geeklogs/shared";
import { MEDIA_TYPES } from "@geeklogs/shared";
import { getMediaBadgeIcon } from "@/lib/mediaBadgeIcons";
import { toRoman } from "@/lib/toRoman";

export type NewBadge = {
  id: string;
  name: string;
  icon: string;
  mediaType?: string | null;
  level?: number | null;
};

function formatBadgeDescription(b: NewBadge): string {
  const level = b.level ?? null;
  const media = b.mediaType ?? null;
  if (level != null && media && MEDIA_TYPES.includes(media as MediaType)) {
    return `${getMediaBadgeIcon(media)} ${toRoman(level)}`;
  }
  if (level != null) {
    return `${b.icon} ${toRoman(level)}`;
  }
  return `${b.icon} ${b.name}`;
}

export function showAchievementToasts(newBadges: NewBadge[], title: string): void {
  newBadges.forEach((b) => {
    toast.success(title, { description: formatBadgeDescription(b) });
  });
}
