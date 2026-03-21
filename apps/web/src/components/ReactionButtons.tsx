import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { ReactionType } from "@geeklogs/shared";
import { apiFetch, invalidateLogsAndItemsCache } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ReactionButtonsProps {
  logId: string;
  likesCount: number;
  dislikesCount: number;
  userReaction: ReactionType | null;
  onReactionChange?: (payload: {
    likesCount: number;
    dislikesCount: number;
    userReaction: ReactionType | null;
  }) => void;
  /** When true, buttons are disabled (e.g. not logged in). */
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function ReactionButtons({
  logId,
  likesCount: initialLikes,
  dislikesCount: initialDislikes,
  userReaction: initialUserReaction,
  onReactionChange,
  disabled = false,
  className,
  size = "sm",
}: ReactionButtonsProps) {
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [dislikesCount, setDislikesCount] = useState(initialDislikes);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(initialUserReaction ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLikesCount(initialLikes);
    setDislikesCount(initialDislikes);
    setUserReaction(initialUserReaction ?? null);
  }, [initialLikes, initialDislikes, initialUserReaction]);

  const handleReaction = async (type: ReactionType) => {
    if (disabled || loading) return;
    const next = userReaction === type ? null : type; // toggle off if same, else set
    const prevLike = userReaction === "like" ? 1 : 0;
    const prevDislike = userReaction === "dislike" ? 1 : 0;
    const newLike = next === "like" ? 1 : 0;
    const newDislike = next === "dislike" ? 1 : 0;
    const newLikes = likesCount - prevLike + newLike;
    const newDislikes = dislikesCount - prevDislike + newDislike;
    const prevLikes = likesCount;
    const prevDislikes = dislikesCount;
    const prevReaction = userReaction;

    // Optimistic update: show new counts and reaction immediately
    setLikesCount(newLikes);
    setDislikesCount(newDislikes);
    setUserReaction(next);
    onReactionChange?.({ likesCount: newLikes, dislikesCount: newDislikes, userReaction: next });
    setLoading(true);

    try {
      if (next) {
        await apiFetch(`/logs/${logId}/reaction`, {
          method: "PUT",
          body: JSON.stringify({ type: next }),
        });
      } else {
        await apiFetch(`/logs/${logId}/reaction`, { method: "DELETE" });
      }
      invalidateLogsAndItemsCache();
    } catch {
      // Revert optimistic update on error
      setLikesCount(prevLikes);
      setDislikesCount(prevDislikes);
      setUserReaction(prevReaction);
      onReactionChange?.({ likesCount: prevLikes, dislikesCount: prevDislikes, userReaction: prevReaction });
    } finally {
      setLoading(false);
    }
  };

  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const textClass = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      className={cn("flex items-center gap-1 text-[var(--color-light)]", className)}
      role="group"
      aria-label="Like or dislike"
    >
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => handleReaction("like")}
        className={cn(
          "flex items-center gap-1 rounded p-1 transition-colors",
          userReaction === "like"
            ? "text-emerald-500 hover:text-emerald-400"
            : "hover:text-[var(--color-lightest)] hover:bg-[var(--color-darkest)]",
          (disabled || loading) && "cursor-not-allowed opacity-60"
        )}
        aria-pressed={userReaction === "like"}
        aria-label="Like"
      >
        <ThumbsUp className={iconClass} />
        <span className={textClass}>{likesCount}</span>
      </button>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => handleReaction("dislike")}
        className={cn(
          "flex items-center gap-1 rounded p-1 transition-colors",
          userReaction === "dislike"
            ? "text-red-400 hover:text-red-300"
            : "hover:text-[var(--color-lightest)] hover:bg-[var(--color-darkest)]",
          (disabled || loading) && "cursor-not-allowed opacity-60"
        )}
        aria-pressed={userReaction === "dislike"}
        aria-label="Dislike"
      >
        <ThumbsDown className={iconClass} />
        <span className={textClass}>{dislikesCount}</span>
      </button>
    </div>
  );
}
