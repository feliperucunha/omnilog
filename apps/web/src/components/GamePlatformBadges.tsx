import { getGamePlatformBadgeClass, getGamePlatformFamily } from "@/lib/gamePlatforms";
import { cn } from "@/lib/utils";

export function GamePlatformBadges({
  platforms,
  className,
}: {
  platforms: string[] | null | undefined;
  className?: string;
}) {
  if (!platforms?.length) return null;

  const seen = new Set<string>();
  const unique = platforms.filter((p) => {
    const key = p.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) return null;

  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {unique.map((platform) => {
        const family = getGamePlatformFamily(platform);
        return (
          <span
            key={platform}
            className={cn(
              "inline-flex max-w-full items-center rounded-md border px-2.5 py-1 text-xs font-medium",
              getGamePlatformBadgeClass(family)
            )}
          >
            <span className="truncate">{platform}</span>
          </span>
        );
      })}
    </span>
  );
}
