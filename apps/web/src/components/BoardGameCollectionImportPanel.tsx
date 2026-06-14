import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import type { BoardGameProvider } from "@geeklogs/shared";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/lib/errorToast";
import {
  startBoardGameCollectionImport,
  pollBoardGameCollectionImportJob,
  CollectionImportStartError,
  type CollectionDuplicateMode,
} from "@/lib/boardGameCollectionImport";
import { ApiError, invalidateApiCache, invalidateLogsAndItemsCache, LOG_LIMIT_REACHED_CODE } from "@/lib/api";
import { toast } from "sonner";

export type BoardGameCollectionImportPanelProps = {
  source: BoardGameProvider;
  onTerminal: (outcome: {
    success: boolean;
    source: BoardGameProvider;
    imported: number;
    skipped: number;
    failed: number;
    replaced: number;
  }) => void;
  onBack?: () => void;
  onPhaseChange?: (phase: "form" | "running") => void;
  /** When true, show the same override checkbox as batch import (add-entry BGG/Ludopedia tab). */
  showDuplicateModeToggle?: boolean;
  /** Onboarding: smaller confirm CTA. */
  variant?: "default" | "onboarding";
  className?: string;
};

function formatNextImport(iso: string, locale: string) {
  try {
    const loc = locale === "es" ? "es" : locale === "pt-BR" ? "pt-BR" : "en-US";
    return new Date(iso).toLocaleString(loc, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function BoardGameCollectionImportPanel({
  source,
  onTerminal,
  onBack,
  onPhaseChange,
  showDuplicateModeToggle = false,
  variant = "default",
  className,
}: BoardGameCollectionImportPanelProps) {
  const { t, locale: appLocale } = useLocale();
  const { me, refetch: refetchMe } = useMe();
  const [username, setUsername] = useState("");
  const [phase, setPhase] = useState<"form" | "running">("form");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<CollectionDuplicateMode>("skip");
  const goPhase = useCallback(
    (p: "form" | "running") => {
      setPhase(p);
      onPhaseChange?.(p);
    },
    [onPhaseChange]
  );

  const [lastJob, setLastJob] = useState<{
    current: number;
    total: number;
    lastTitle: string | null;
  } | null>(null);

  const runImport = useCallback(async () => {
    if (username.trim() === "") return;
    goPhase("running");
    setLastJob(null);
    setConfirmOpen(false);
    try {
      const { jobId } = await startBoardGameCollectionImport({
        source,
        bggUsername: source === "bgg" ? username.trim() : undefined,
        ludopediaUsername: source === "ludopedia" ? username.trim() : undefined,
        duplicateMode,
      });
      const final = await pollBoardGameCollectionImportJob(jobId, {
        onUpdate: (j) => {
          setLastJob({ current: j.current, total: j.total, lastTitle: j.lastTitle });
        },
        maxWaitMs: 185_000,
        intervalMs: 450,
      });
      void refetchMe();
      void invalidateApiCache("/search");
      void invalidateLogsAndItemsCache();
      if (final.status === "completed") {
        onTerminal({
          success: true,
          source,
          imported: final.imported,
          skipped: final.skipped,
          failed: final.failed,
          replaced: final.replaced,
        });
        toast.success(
          t("boardGameImport.doneToast", {
            imported: String(final.imported),
            replaced: String(final.replaced),
            skipped: String(final.skipped),
            failed: String(final.failed),
          })
        );
        return;
      }
      if (final.status === "limit_reached") {
        onTerminal({
          success: true,
          source,
          imported: final.imported,
          skipped: final.skipped,
          failed: final.failed,
          replaced: final.replaced,
        });
        toast.message(t("boardGameImport.logLimitMessage"));
        return;
      }
      onTerminal({ success: false, source, imported: final.imported, skipped: final.skipped, failed: final.failed, replaced: final.replaced });
      if (final.error) {
        toast.error(final.error);
      } else {
        showErrorToast(t, "E008", { originalError: new Error("Import failed") });
      }
      goPhase("form");
    } catch (e) {
      onTerminal({ success: false, source, imported: 0, skipped: 0, failed: 0, replaced: 0 });
      if (e instanceof CollectionImportStartError) {
        if (e.status === 429 || e.errorCode === "COLLECTION_IMPORT_COOLDOWN") {
          const when = e.nextAvailableAt
            ? formatNextImport(e.nextAvailableAt, appLocale)
            : "—";
          toast.error(t("boardGameImport.cooldownWithTime", { when }), { duration: 8000 });
        } else {
          toast.error(e.message, { duration: 6500 });
        }
        goPhase("form");
        return;
      }
      if (e instanceof ApiError && e.message === LOG_LIMIT_REACHED_CODE) {
        toast.message(t("boardGameImport.logLimitMessage"));
        return;
      }
      showErrorToast(t, "E008", { originalError: e });
      goPhase("form");
    }
  }, [onTerminal, source, t, username, goPhase, duplicateMode, appLocale, refetchMe]);

  const pct = lastJob && lastJob.total > 0 ? Math.min(100, Math.round((lastJob.current / lastJob.total) * 100)) : 0;
  const runningLabel = lastJob
    ? t("boardGameImport.progressLabel", {
        current: String(lastJob.current),
        total: String(lastJob.total),
      })
    : t("boardGameImport.starting");

  if (phase === "running") {
    return (
      <div className={cn("flex flex-col gap-2.5", className)} aria-live="polite" aria-busy>
        <p className="text-sm font-medium text-[var(--color-lightest)]">{t("boardGameImport.importingTitle")}</p>
        <p className="text-xs text-[var(--color-light)]">{runningLabel}</p>
        {lastJob?.lastTitle ? (
          <p className="line-clamp-1 text-xs text-[var(--color-mid)]">{lastJob.lastTitle}</p>
        ) : null}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-darkest)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--btn-gradient-start)] to-[var(--btn-gradient-end)] transition-all duration-300"
            style={{ width: `${pct}%`, minWidth: pct > 0 ? "4px" : 0 }}
          />
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-[var(--color-light)]">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>{t("boardGameImport.pleaseWaitShort")}</span>
        </div>
      </div>
    );
  }

  const isBgg = source === "bgg";
  const coolDownUntil = me?.boardGameCollectionImportNextAt ?? null;
  const isOnCooldown = coolDownUntil != null && coolDownUntil !== "";
  const cooldownWhen = isOnCooldown && coolDownUntil ? formatNextImport(coolDownUntil, appLocale) : null;

  const isOnboarding = variant === "onboarding";
  const confirmTitle = isOnboarding ? t("boardGameImport.confirmOnboardingTitle") : t("boardGameImport.confirmTitle");
  const confirmBody = isOnboarding ? t("boardGameImport.confirmOnboardingBody") : t("boardGameImport.confirmBody");
  const confirmCta = isOnboarding ? t("boardGameImport.confirmStartShort") : t("boardGameImport.confirmStart");

  return (
    <div className={cn("flex flex-col gap-3", isOnboarding && "gap-2.5", className)}>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          variant="compact"
          onClose={() => setConfirmOpen(false)}
          className="max-w-[min(100%,22rem)] border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
        >
          <DialogHeader className="text-left">
            <DialogTitle className="text-base text-[var(--color-lightest)]">{confirmTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-[var(--color-light)]">{confirmBody}</p>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-9 rounded-lg text-sm" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" className="h-9 rounded-lg text-sm" onClick={() => void runImport()}>
              {confirmCta}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isOnCooldown && cooldownWhen ? (
        <p className="rounded-lg border border-[var(--color-warning-border)]/80 bg-[var(--color-warning-bg)]/30 px-2.5 py-1.5 text-xs text-[var(--color-warning-text)]">
          {t("boardGameImport.cooldownShort", { when: cooldownWhen })}
        </p>
      ) : null}
      <div className={cn("space-y-2", isOnboarding && "space-y-1.5")}>
        <Label htmlFor="bg-imp-user" className={cn("text-[var(--color-lightest)]", isOnboarding && "text-sm")}>
          {isBgg ? t("boardGameImport.bggUsername") : t("boardGameImport.ludopediaUsername")}
        </Label>
        <Input
          id="bg-imp-user"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder={isBgg ? "BGBuddy" : t("boardGameImport.ludopediaUsername")}
          className="h-10 rounded-xl border-[var(--color-surface-border)]/70 bg-[var(--color-darkest)]/50"
        />
        {showDuplicateModeToggle ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bg-imp-override-existing"
                checked={duplicateMode === "replace"}
                onChange={(e) => setDuplicateMode(e.target.checked ? "replace" : "skip")}
                className="h-4 w-4 rounded border-[var(--color-mid)] bg-[var(--color-dark)] text-[var(--btn-gradient-start)] focus:ring-2 focus:ring-[var(--btn-gradient-start)]/50"
                aria-describedby="bg-imp-override-existing-desc"
              />
              <Label
                htmlFor="bg-imp-override-existing"
                className="cursor-pointer text-sm font-normal text-[var(--color-lightest)]"
              >
                {t("batchEntry.overrideExistingLogs")}
              </Label>
            </div>
            <p id="bg-imp-override-existing-desc" className="text-xs text-[var(--color-light)]">
              {t("batchEntry.overrideExistingLogsHint")}
            </p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        {onBack && !isOnboarding ? (
          <Button type="button" variant="ghost" className="h-9 shrink-0 rounded-lg text-sm text-[var(--color-light)]" onClick={onBack}>
            {t("onboarding.back")}
          </Button>
        ) : null}
        <Button
          type="button"
          className={cn("h-10 flex-1 rounded-xl", isOnboarding && "h-9 text-sm")}
          disabled={username.trim() === "" || isOnCooldown}
          onClick={() => setConfirmOpen(true)}
        >
          {t("boardGameImport.startImport")}
        </Button>
      </div>
    </div>
  );
}
