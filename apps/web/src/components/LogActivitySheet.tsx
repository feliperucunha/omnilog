import { Link } from "react-router-dom";
import { useLocale } from "@/contexts/LocaleContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { ItemImage } from "@/components/ItemImage";
import { StarRating } from "@/components/StarRating";
import { gradeToStars } from "@/lib/gradeStars";
import { formatTimeToFinish } from "@/lib/formatDuration";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { IN_PROGRESS_STATUSES, type Log } from "@geeklogs/shared";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { itemDetailPath } from "@/lib/itemRoutes";

function LogActivityList({
  logs,
  loading,
  onNavigate,
}: {
  logs: Log[];
  loading: boolean;
  onNavigate: () => void;
}) {
  const { t } = useLocale();

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-mid)] border-t-[var(--color-lightest)]" />
      </div>
    );
  }
  if (logs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--color-light)]">
        {t("dashboard.calendarNoActivity")}
      </p>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {logs.map((log) => (
        <li key={log.id}>
          <Link
            to={itemDetailPath(log.mediaType, log.externalId)}
            className="flex gap-3 rounded-lg border border-[var(--color-mid)]/20 bg-[var(--color-darkest)]/50 p-3 text-inherit no-underline hover:bg-[var(--color-mid)]/15"
            onClick={onNavigate}
          >
            <ItemImage
              src={log.image}
              className="h-14 w-10 shrink-0 rounded object-cover"
              mediaType={log.mediaType}
              boardGameSource={log.boardGameSource}
            />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <OverflowMarquee className="text-sm font-medium text-[var(--color-lightest)]">
                {log.title}
              </OverflowMarquee>
              <p className="text-xs text-[var(--color-light)]">
                {t(`nav.${log.mediaType}`)}
                {(() => {
                  const duration =
                    log.startedAt && log.completedAt ? formatTimeToFinish(log.startedAt, log.completedAt) : "";
                  return duration ? <> · {t("dashboard.finishedIn", { duration })}</> : null;
                })()}
              </p>
              {log.status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(log.status) ? (
                <span className="w-fit rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-medium text-white">
                  {t("common.inProgress")}
                </span>
              ) : log.grade != null ? (
                <StarRating value={gradeToStars(log.grade)} readOnly size="sm" showGradeText={false} />
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function LogActivitySheet({
  open,
  onClose,
  title,
  logs,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  logs: Log[];
  loading: boolean;
}) {
  const isMobile = useIsMobile();

  if (!open) return null;

  if (isMobile) {
    return (
      <Drawer open onOpenChange={(next) => !next && onClose()}>
        <DrawerContent mobileHeight="95%" className="flex flex-col p-4 sm:p-6" onClose={onClose}>
          <div className="mt-6">
            <OverflowMarquee className="mb-4 min-w-0 text-lg font-semibold text-[var(--color-lightest)]">
              {title}
            </OverflowMarquee>
            <LogActivityList logs={logs} loading={loading} onNavigate={onClose} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col" onClose={onClose}>
        <DialogHeader className="shrink-0 space-y-0 pr-8 text-left sm:pr-10">
          <DialogTitle className="min-w-0 text-[var(--color-lightest)]">
            <OverflowMarquee>{title}</OverflowMarquee>
          </DialogTitle>
        </DialogHeader>
        <div className="-mx-1 min-h-0 overflow-y-auto px-1">
          <LogActivityList logs={logs} loading={loading} onNavigate={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
