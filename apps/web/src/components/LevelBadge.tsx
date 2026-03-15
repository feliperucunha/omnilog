import { toRoman } from "@/lib/toRoman";
import { useLocale } from "@/contexts/LocaleContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Rarity tiers by level (1–12), game-style: common → legendary. */
const BADGE_RARITY = [
  { name: "common", color: "#94a3b8", gradient: "linear-gradient(145deg, #94a3b8 0%, #64748b 100%)" },      // 1–2
  { name: "uncommon", color: "#22c55e", gradient: "linear-gradient(145deg, #4ade80 0%, #16a34a 100%)" },     // 3–4
  { name: "rare", color: "#3b82f6", gradient: "linear-gradient(145deg, #60a5fa 0%, #2563eb 100%)" },         // 5–6
  { name: "epic", color: "#a855f7", gradient: "linear-gradient(145deg, #c084fc 0%, #7c3aed 100%)" },       // 7–8
  { name: "legendary", color: "#eab308", gradient: "linear-gradient(145deg, #fde047 0%, #ca8a04 100%)" },  // 9–12
] as const;

function getRarityForLevel(level: number): (typeof BADGE_RARITY)[number] {
  const index = level <= 2 ? 0 : level <= 4 ? 1 : level <= 6 ? 2 : level <= 8 ? 3 : 4;
  return BADGE_RARITY[index];
}

export interface BadgePopupDetail {
  /** Display name (e.g. "You" for current user, or username for others) */
  user: string;
  /** Category name (e.g. "Movies", "Games") */
  categoryLabel: string;
  /** For item page: badge label when we don't have count (e.g. "Movie Reviewer II (10)") */
  label?: string;
  /** Current count (reviews or logs) in this category */
  count?: number;
  /** Threshold at which this badge was earned or next badge is earned */
  threshold?: number;
  /** "reviews" or "logs" */
  kind?: "reviews" | "logs";
  /** If true, show "Next badge at X" instead of "Badge earned at X" */
  isNext?: boolean;
}

interface LevelBadgeProps {
  /** Icon (emoji or character) shown inside the insignia */
  icon: string;
  /** 1-based level, displayed as Roman numeral beside the insignia */
  level: number;
  /** Optional title/tooltip */
  title?: string;
  /** Optional class on the wrapper */
  className?: string;
  /** When provided, badge is clickable and shows a popup with count/category info */
  popupDetail?: BadgePopupDetail;
}

function BadgeInsignia({
  icon,
  level,
  className = "",
}: {
  icon: string;
  level: number;
  className?: string;
}) {
  const rarity = getRarityForLevel(level);
  return (
    <span className={`inline-flex items-center gap-1.5 max-md:gap-2 ${className}`}>
      <span
        className="inline-flex h-6 w-6 max-md:h-8 max-md:w-8 flex-shrink-0 items-center justify-center rounded-full p-[3px] max-md:p-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_2px_rgba(0,0,0,0.3)]"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(0,0,0,0.2) 100%)",
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.35), 0 0 0 2px ${rarity.color}`,
        }}
        aria-hidden
      >
        <span
          className="flex h-full w-full items-center justify-center rounded-full text-[var(--color-lightest)] text-[0.65rem] max-md:text-[0.8rem]"
          style={{
            background: rarity.gradient,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2)",
            lineHeight: 1,
          }}
        >
          {icon}
        </span>
      </span>
      <span
        className="text-xs max-md:text-sm font-bold tabular-nums"
        style={{ color: rarity.color }}
      >
        {toRoman(level)}
      </span>
    </span>
  );
}

/**
 * Insignia-style badge inspired by Pokémon gym badges: circular medal with metallic ring,
 * green gradient face, and centered icon; level in Roman numerals beside it.
 * When popupDetail is provided, click/tap opens a responsive popup with category and count info.
 */
function getKindLabel(
  t: (key: string, params?: Record<string, string>) => string,
  kind: "reviews" | "logs",
  count: number
): string {
  const singularKey =
    kind === "logs" ? "mediaLogs.badgePopupLog" : "mediaLogs.badgePopupReview";
  const pluralKey =
    kind === "logs" ? "mediaLogs.badgePopupLogs" : "mediaLogs.badgePopupReviews";
  return count === 1 ? t(singularKey) : t(pluralKey);
}

export function LevelBadge({ icon, level, title, className = "", popupDetail }: LevelBadgeProps) {
  const { t } = useLocale();

  const content = (() => {
    if (!popupDetail) return null;
    const { user, categoryLabel, label, count, kind } = popupDetail;
    // Item page: only category + label (no count from API)
    if (count == null) {
      return t("itemPage.badgePopupUserEarnedIn", {
        user,
        category: categoryLabel,
        label: label ?? title ?? "—",
      });
    }
    // MediaLogs: "{user} has {amount} {kind} in {category}"
    if (kind == null) return null;
    const kindLabel = count === 1 ? getKindLabel(t, kind, 1) : getKindLabel(t, kind, 2);
    const amount = String(count);
    const isYou = user === t("mediaLogs.badgePopupYou");
    return isYou
      ? t("mediaLogs.badgePopupYouHas", { amount, kind: kindLabel, category: categoryLabel })
      : t("mediaLogs.badgePopupUserHas", { user, amount, kind: kindLabel, category: categoryLabel });
  })();

  const hasPopup = popupDetail != null && content != null;

  const badgeNode = (
    <BadgeInsignia icon={icon} level={level} className={className} />
  );

  if (hasPopup) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={content}
            className="cursor-pointer touch-manipulation rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--btn-gradient-start)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-dark)]"
            aria-label={content}
          >
            {badgeNode}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          sideOffset={6}
          align="start"
          collisionPadding={16}
          className="max-w-[min(280px,calc(100vw-2rem))] border-[var(--color-surface-border)] bg-[var(--color-dark)] px-3 py-2 shadow-lg"
        >
          <p className="text-sm text-[var(--color-light)]">{content}</p>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <span className="inline-flex" title={title}>
      {badgeNode}
    </span>
  );
}
