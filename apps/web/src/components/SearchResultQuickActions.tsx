import { Check, Expand, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  LOG_STATUS_OPTIONS,
  type BoardGameProvider,
  type Log,
  type MediaType,
  type SearchResult,
} from "@geeklogs/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TFunction } from "@/contexts/LocaleContext";
import { apiFetch, invalidateLogsAndItemsCache } from "@/lib/api";
import { getErrorMessageKey } from "@/lib/errorCodes";
import { getStatusLabel } from "@/lib/statusLabel";
import { cn } from "@/lib/utils";

let quickActionSeq = 0;

/**
 * Quick action "+" button on each search result card. Opens a dropdown with a
 * "Review & details" entry (item detail page) plus every status available for
 * that category, so the user can set the status straight from search results.
 */
export function SearchResultQuickActions({
  item,
  mediaType,
  userLog,
  boardGameProvider,
  onOpenItem,
  t,
  className,
}: {
  item: SearchResult;
  mediaType: MediaType;
  userLog?: Pick<Log, "id" | "status" | "listType">;
  boardGameProvider: BoardGameProvider;
  onOpenItem: () => void;
  t: TFunction;
  className?: string;
}) {
  const currentStatus = userLog?.status ?? userLog?.listType ?? null;

  const setStatus = async (status: string) => {
    const id = `search-quick-${item.id}-${++quickActionSeq}`;
    toast.loading(t("search.quickStatusLoading"), { id });
    try {
      let log: Log;
      if (userLog?.id) {
        log = await apiFetch<Log>(`/logs/${userLog.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
      } else {
        const body: Record<string, unknown> = {
          mediaType,
          externalId: item.id,
          title: item.title,
          image: item.image ?? null,
          status,
        };
        if (mediaType === "boardgames") {
          body.boardGameSource = boardGameProvider;
        }
        log = await apiFetch<Log>("/logs", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      invalidateLogsAndItemsCache();
      toast.success(
        t("search.quickStatusSuccess", {
          title: item.title,
          status: getStatusLabel(t, log.status ?? status, mediaType),
        }),
        { id }
      );
    } catch (err) {
      toast.error(t(getErrorMessageKey("E008")), { id });
      console.error("[E008]", err);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("search.quickActionLabel")}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)] text-[var(--color-lightest)] shadow-[var(--shadow-sm)] transition-[transform,box-shadow] hover:scale-[1.04] hover:shadow-[var(--shadow-md)] active:scale-[0.98] [touch-action:manipulation]",
            className
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[11rem]">
        <DropdownMenuItem onSelect={onOpenItem}>
          <Expand className="h-4 w-4 shrink-0 text-[var(--color-light)]" aria-hidden />
          {t("search.quickReviewItem")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {LOG_STATUS_OPTIONS[mediaType].map((s) => {
          const active = currentStatus === s;
          return (
            <DropdownMenuItem key={s} onSelect={() => void setStatus(s)}>
              <span className="min-w-0 flex-1">{getStatusLabel(t, s, mediaType)}</span>
              {active && <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}