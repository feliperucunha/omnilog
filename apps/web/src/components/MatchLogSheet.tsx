import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { BoardGameMatchesSection } from "@/components/BoardGameMatchesSection";
import { useLocale } from "@/contexts/LocaleContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import type { Log } from "@geeklogs/shared";

/**
 * Match-only overlay. Same chrome as the log form: a bottom sheet on the phone,
 * a centered dialog on desktop. Play history stays on the item Matches tab.
 */
export function MatchLogSheet({
  log,
  title,
  onClose,
  onLogUpdated,
  onEnsureLog,
  onMatchSaved,
}: {
  log: Log | null;
  title: string;
  onClose: () => void;
  onLogUpdated: (log: Log) => void;
  onEnsureLog?: () => Promise<string>;
  onMatchSaved?: (log: Log) => void;
}) {
  const { t } = useLocale();
  const isMobile = useIsMobile();

  const body = (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0 pr-8">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-light)]">
          {t("mediaLogs.addMatch")}
        </p>
        <h2 className="page-title mt-1 truncate text-[var(--color-lightest)]" title={title}>
          {title}
        </h2>
      </div>
      <BoardGameMatchesSection
        sessionOnly
        logId={log?.id ?? null}
        onLogUpdated={onLogUpdated}
        onEnsureLog={onEnsureLog}
        onMatchSaved={(log) => {
          onMatchSaved?.(log);
          onClose();
        }}
      />
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open modal={false} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent
          onClose={onClose}
          ignoreOutsideCloseForMs={450}
          mobileHeight="95%"
          className="px-4 pb-6"
        >
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open modal={false} onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClose={onClose} className="flex max-h-[80vh] flex-col overflow-y-auto rounded-[18px] sm:max-w-lg">
        {body}
      </DialogContent>
    </Dialog>
  );
}
