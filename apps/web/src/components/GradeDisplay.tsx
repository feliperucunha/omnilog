import { gradeToStars } from "@/lib/gradeStars";
import { cn } from "@/lib/utils";

export type GradeDisplaySize = "sm" | "md" | "lg";
export type GradeDisplayVariant = "default" | "onDark";

export interface GradeDisplayProps {
  grade: number | null | undefined;
  size?: GradeDisplaySize;
  /** `onDark` = light text for hero overlays; `default` = amber chip for cards and lists. */
  variant?: GradeDisplayVariant;
  className?: string;
}

/**
 * Read-only grade 1–10 as a compact, high-contrast pill (no star row).
 * Use in list rows and cards; keep `StarRating` for interactive forms and modals that need stars.
 */
export function GradeDisplay({
  grade,
  size = "sm",
  variant = "default",
  className,
}: GradeDisplayProps) {
  const n = gradeToStars(grade);
  if (n == null) return null;

  const isDark = variant === "onDark";

  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-baseline gap-0.5 rounded-lg border font-bold tabular-nums leading-none tracking-tight",
        isDark &&
          (size === "sm"
            ? "border-white/30 bg-black/50 px-1.5 py-0.5 text-xs text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-sm"
            : size === "md"
              ? "border-white/35 bg-black/45 px-2 py-1 text-sm text-white shadow-[0_2px_16px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-2.5 sm:py-1.5 sm:text-base"
              : "border-white/35 bg-black/45 px-2.5 py-1.5 text-lg text-white shadow-[0_2px_16px_rgba(0,0,0,0.45)] backdrop-blur-[2px] sm:px-3 sm:py-2 sm:text-xl"),
        !isDark && "border-amber-500/55 bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-amber-950/25 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_3px_rgba(0,0,0,0.25)]",
        !isDark && size === "sm" && "px-1.5 py-0.5 text-xs",
        !isDark && size === "md" && "px-2 py-0.5 text-sm sm:text-base",
        !isDark && size === "lg" && "px-2.5 py-1 text-base sm:text-lg",
        className
      )}
    >
      <span className={isDark ? "text-white" : "text-amber-50"}>{n}</span>
      <span
        className={cn(
          "font-semibold",
          isDark ? "text-white/80" : "text-amber-500/90"
        )}
      >
        /10
      </span>
    </span>
  );
}
