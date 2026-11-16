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
        <h2 className="text-lg font-semibold text-[var(--color-lightest)]">{t("mediaLogs.addMatch")}</h2>
        <p className="mt-1 truncate text-2xl font-semibold text-[var(--color-lightest)]" title={title}>
          {title}
        </p>
      </div>
      <BoardGameMatchesSection
        sessionOnly
        logId={log?.id ?? null}
        onLogUpdated={onLogUpdated}
        onEnsureLog={onEnsureLog}
        onMatchSaved={onMatchSaved}
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
          className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-y-auto p-4 sm:p-6"
        >
          <div className="mt-6">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open modal={false} onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClose={onClose} className="flex max-h-[90vh] flex-col overflow-y-auto sm:max-w-lg">
        {body}
      </DialogContent>
    </Dialog>
  );
}
