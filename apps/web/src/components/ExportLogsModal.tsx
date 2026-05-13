import { useMemo, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useLocale } from "@/contexts/LocaleContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { MEDIA_TYPES, LOG_STATUS_OPTIONS, type MediaType } from "@geeklogs/shared";
import { mediaTypeHasCollectionOwnership } from "@/lib/mediaTypeFeatures";
import { getStatusLabel } from "@/lib/statusLabel";
import type { CollectionListFilter, MediaLogsSort } from "@/pages/MediaLogs";

export type ExportCategory = MediaType | "all";

export interface ExportLogsOptions {
  mediaType: ExportCategory;
  status: string;
  collection: CollectionListFilter;
  sort: MediaLogsSort;
}

interface ExportLogsModalProps {
  defaultMediaType: MediaType;
  /** Pre-fill from currently active filters (when matching the default mediaType). */
  defaultStatus?: string;
  defaultCollection?: CollectionListFilter;
  defaultSort?: MediaLogsSort;
  exporting?: boolean;
  onExport: (opts: ExportLogsOptions) => void;
  onCancel: () => void;
}

const sortOptionsFor = (
  category: ExportCategory,
  t: (key: string) => string
): { value: MediaLogsSort; label: string }[] => {
  const base: { value: MediaLogsSort; label: string }[] = [
    { value: "dateDesc", label: t("mediaLogs.sortByDateDesc") },
    { value: "dateAsc", label: t("mediaLogs.sortByDateAsc") },
    { value: "gradeDesc", label: t("mediaLogs.sortByGradeDesc") },
    { value: "gradeAsc", label: t("mediaLogs.sortByGradeAsc") },
  ];
  if (category === "boardgames") {
    base.push(
      { value: "matchesPlayedDesc", label: t("mediaLogs.sortByMatchesPlayedDesc") },
      { value: "matchesPlayedAsc", label: t("mediaLogs.sortByMatchesPlayedAsc") }
    );
  } else if (category === "games") {
    base.push(
      { value: "timeToBeatDesc", label: t("mediaLogs.sortByTimeToBeatDesc") },
      { value: "timeToBeatAsc", label: t("mediaLogs.sortByTimeToBeatAsc") }
    );
  }
  return base;
};

export function ExportLogsModal({
  defaultMediaType,
  defaultStatus = "",
  defaultCollection = "",
  defaultSort = "dateDesc",
  exporting = false,
  onExport,
  onCancel,
}: ExportLogsModalProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();

  const [category, setCategory] = useState<ExportCategory>(defaultMediaType);
  const [status, setStatus] = useState<string>(defaultStatus);
  const [collection, setCollection] = useState<CollectionListFilter>(defaultCollection);
  const [sort, setSort] = useState<MediaLogsSort>(defaultSort);

  const showStatus = category !== "all";
  const showCollection = category !== "all" && mediaTypeHasCollectionOwnership(category);

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: t("exportLogsModal.categoryAll") },
      ...MEDIA_TYPES.map((m) => ({ value: m, label: t(`nav.${m}`) })),
    ],
    [t]
  );

  const statusOptions = useMemo(() => {
    if (category === "all") return [];
    const list = LOG_STATUS_OPTIONS[category];
    return [
      { value: "", label: t("mediaLogs.filterAll") },
      ...list.map((s) => ({ value: s, label: getStatusLabel(t, s, category) })),
    ];
  }, [category, t]);

  const collectionOptions = useMemo(
    () => [
      { value: "", label: t("mediaLogs.filterAll") },
      { value: "owned", label: t("mediaLogs.filterOwned") },
      { value: "wantToBuy", label: t("mediaLogs.filterWantToBuy") },
    ],
    [t]
  );

  const sortOptions = useMemo(() => sortOptionsFor(category, t), [category, t]);

  const handleCategoryChange = useCallback(
    (next: string) => {
      const value = next as ExportCategory;
      setCategory(value);
      setStatus("");
      setCollection("");
      const allowed = sortOptionsFor(value, t).map((o) => o.value);
      if (!allowed.includes(sort)) setSort("dateDesc");
    },
    [sort, t]
  );

  const handleSubmit = useCallback(() => {
    onExport({ mediaType: category, status, collection, sort });
  }, [category, status, collection, sort, onExport]);

  const formContent = (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label className="text-sm text-[var(--color-lightest)]">
          {t("exportLogsModal.categoryLabel")}
        </Label>
        <Select
          value={category}
          onValueChange={handleCategoryChange}
          options={categoryOptions}
          aria-label={t("exportLogsModal.categoryLabel")}
        />
      </div>

      {showStatus && (
        <div className="space-y-1.5">
          <Label className="text-sm text-[var(--color-lightest)]">
            {t("exportLogsModal.statusLabel")}
          </Label>
          <Select
            value={status}
            onValueChange={setStatus}
            options={statusOptions}
            aria-label={t("exportLogsModal.statusLabel")}
          />
        </div>
      )}

      {showCollection && (
        <div className="space-y-1.5">
          <Label className="text-sm text-[var(--color-lightest)]">
            {t("mediaLogs.filterCollection")}
          </Label>
          <Select
            value={collection}
            onValueChange={(v) => setCollection(v as CollectionListFilter)}
            options={collectionOptions}
            aria-label={t("mediaLogs.filterCollection")}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm text-[var(--color-lightest)]">
          {t("exportLogsModal.sortLabel")}
        </Label>
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as MediaLogsSort)}
          options={sortOptions}
          aria-label={t("exportLogsModal.sortLabel")}
        />
      </div>
    </div>
  );

  const downloadButton = (
    <Button
      type="button"
      onClick={handleSubmit}
      disabled={exporting}
      className="btn-gradient w-full sm:w-auto"
    >
      {exporting ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("exportLogsModal.downloading")}
        </span>
      ) : (
        t("exportLogsModal.download")
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer
        open
        modal={false}
        onOpenChange={(open) => {
          if (!open && !exporting) onCancel();
        }}
      >
        <DrawerContent
          onClose={() => {
            if (!exporting) onCancel();
          }}
          mobileHeight="auto"
          className="flex w-full max-w-lg flex-col gap-0 overflow-hidden p-4 sm:p-6"
        >
          <div className="mt-4 space-y-3">
            <div className="text-base font-semibold text-[var(--color-lightest)]">
              <OverflowMarquee>{t("exportLogsModal.title")}</OverflowMarquee>
            </div>
            <p className="text-sm text-[var(--color-light)]">
              {t("exportLogsModal.description")}
            </p>
            {formContent}
          </div>
          <DrawerFooter>
            <div className="flex w-full gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={exporting}
              >
                {t("common.cancel")}
              </Button>
              <div className="flex-1">{downloadButton}</div>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open modal={false}>
      <DialogContent
        onClose={() => {
          if (!exporting) onCancel();
        }}
        className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-md flex-col gap-4 overflow-hidden p-4 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="min-w-0 text-[var(--color-lightest)]">
            <OverflowMarquee>{t("exportLogsModal.title")}</OverflowMarquee>
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-light)]">
          {t("exportLogsModal.description")}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto">{formContent}</div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={exporting}>
            {t("common.cancel")}
          </Button>
          {downloadButton}
        </div>
      </DialogContent>
    </Dialog>
  );
}
