import { useRef, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Value in stars: 0, 0.5, 1, ..., 5. DB stores 0–10 (value * 2). */
interface StarRatingProps {
  value: number;
  onChange?: (stars: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  "aria-required"?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
  className,
  "aria-required": ariaRequired,
}: StarRatingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;
  const clamped = Math.max(0, Math.min(5, displayValue));

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const raw = pct * 5;
    const stars = Math.round(raw * 2) / 2;
    const clampedStars = Math.max(0, Math.min(5, stars));
    if (e.type === "click") {
      onChange?.(clampedStars);
    } else {
      setHoverValue(clampedStars);
    }
  };

  const handlePointerLeave = () => {
    if (!readOnly) setHoverValue(null);
  };

  return (
    <div
      ref={containerRef}
      role={readOnly ? "img" : "slider"}
      aria-label={readOnly ? `${value} stars` : "Rating"}
      aria-required={ariaRequired}
      aria-valuemin={readOnly ? undefined : 0}
      aria-valuemax={readOnly ? undefined : 5}
      aria-valuenow={readOnly ? undefined : value}
      aria-valuetext={readOnly ? undefined : `${value} stars`}
      className={cn(
        "inline-flex items-center gap-0.5",
        !readOnly && "cursor-pointer select-none",
        className
      )}
      onPointerMove={handlePointer}
      onPointerLeave={handlePointerLeave}
      onClick={handlePointer}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = clamped - i;
        const filled = fill >= 1 ? 1 : fill >= 0.5 ? 0.5 : 0;
        return (
          <div
            key={i}
            className="relative inline-flex"
            style={{ width: size === "sm" ? 16 : size === "md" ? 24 : 32 }}
          >
            <Star
              className={cn(
                sizeClasses[size],
                "text-[var(--color-darkest)]",
                "fill-[var(--color-darkest)]"
              )}
              strokeWidth={1.5}
              aria-hidden
            />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${filled * 100}%` }}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  "text-amber-400 fill-amber-400"
                )}
                strokeWidth={1.5}
                aria-hidden
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
