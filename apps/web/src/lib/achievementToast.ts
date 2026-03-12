import { toast } from "sonner";

export type NewBadge = { id: string; name: string; icon: string };

export function showAchievementToasts(
  newBadges: NewBadge[],
  title: string
): void {
  newBadges.forEach((b) =>
    toast.success(title, { description: `${b.icon} ${b.name}` })
  );
}
