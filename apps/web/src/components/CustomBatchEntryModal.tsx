import { useState, useRef, useCallback, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { BatchEntryTab } from "@/components/BatchEntryTab";
import { BoardGameCollectionImportPanel } from "@/components/BoardGameCollectionImportPanel";
import { useLocale } from "@/contexts/LocaleContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import type { MediaType } from "@geeklogs/shared";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { cn } from "@/lib/utils";

type Tab = "batch" | "bggImport" | "ludopediaImport";

interface CustomBatchEntryModalProps {
  mediaType: MediaType;
  onSaved: (completion?: LogCompleteState) => void;
  onCancel: () => void;
}

const tabClass = (active: boolean) =>
  cn(
    "rounded-md px-2.5 py-2 text-sm font-medium transition-colors sm:px-3",
    active ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]" : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
  );

function CustomBatchEntryModalTabs({
  mediaType,
  tab,
  setTab,
  t,
}: {
  mediaType: MediaType;
  tab: Tab;
  setTab: (t: Tab) => void;
  t: (key: string) => string;
}) {
  if (mediaType !== "boardgames") return null;
  return (
    <div
      className="mb-3 flex shrink-0 flex-col gap-1.5 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-1.5 sm:mb-4"
    >
      <div className="grid grid-cols-3 gap-1">
        <button type="button" onClick={() => setTab("batch")} className={tabClass(tab === "batch")}>
          {t("customEntry.tabBatch")}
        </button>
        <button type="button" onClick={() => setTab("bggImport")} className={tabClass(tab === "bggImport")}>
          {t("customEntry.tabBggImport")}
        </button>
        <button
          type="button"
          onClick={() => setTab("ludopediaImport")}
          className={tabClass(tab === "ludopediaImport")}
        >
          {t("customEntry.tabLudopediaImport")}
        </button>
      </div>
    </div>
  );
}

export function CustomBatchEntryModal({ mediaType, onSaved, onCancel }: CustomBatchEntryModalProps) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("batch");
  const [batchFooter, setBatchFooter] = useState<ReactNode>(null);
  const [importRunning, setImportRunning] = useState(false);
  const isMobile = useIsMobile();
  const drawerRequestCloseRef = useRef<(() => void) | null>(null);

  const closeOrCancel = useCallback(() => {
    if (importRunning) return;
    onCancel();
  }, [importRunning, onCancel]);

  const handleDrawerClose = useCallback(() => {
    if (importRunning) return;
    drawerRequestCloseRef.current?.() ?? onCancel();
  }, [importRunning, onCancel]);

  const handleWebDialogClose = useCallback(() => {
    if (importRunning) return;
    onCancel();
  }, [importRunning, onCancel]);

  const importPanel = (source: "bgg" | "ludopedia") => (
    <BoardGameCollectionImportPanel
      source={source}
      showDuplicateModeToggle
      onPhaseChange={(ph) => setImportRunning(ph === "running")}
      onBack={() => setTab("batch")}
      onTerminal={(o) => {
        if (o.success) onSaved();
      }}
    />
  );

  if (isMobile) {
    return (
      <Drawer
        open
        modal={false}
        onOpenChange={(open) => {
          if (!open && !importRunning) onCancel();
        }}
      >
        <DrawerContent
          onClose={closeOrCancel}
          onReady={(requestClose) => {
            drawerRequestCloseRef.current = requestClose;
          }}
          mobileHeight="95%"
          className="flex max-h-[85dvh] w-full max-w-lg flex-col gap-0 overflow-hidden p-4 sm:p-6"
        >
          <div className="mt-6">
            <CustomBatchEntryModalTabs mediaType={mediaType} tab={tab} setTab={setTab} t={t} />
            {tab === "batch" ? (
              <BatchEntryTab
                initialMediaType={mediaType}
                onDone={onSaved}
                onCancel={handleDrawerClose}
                renderFooterOutside
                onFooterChange={setBatchFooter}
              />
            ) : tab === "bggImport" ? (
              importPanel("bgg")
            ) : (
              importPanel("ludopedia")
            )}
          </div>
          <DrawerFooter>
            {tab === "batch" ? batchFooter : null}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  const modalContent = (
    <>
      <CustomBatchEntryModalTabs mediaType={mediaType} tab={tab} setTab={setTab} t={t} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "batch" ? (
          <BatchEntryTab initialMediaType={mediaType} onDone={onSaved} onCancel={onCancel} />
        ) : tab === "bggImport" ? (
          importPanel("bgg")
        ) : (
          importPanel("ludopedia")
        )}
      </div>
    </>
  );

  return (
    <Dialog open modal={false}>
      <DialogContent
        onClose={handleWebDialogClose}
        className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-4 sm:p-6"
      >
        {modalContent}
      </DialogContent>
    </Dialog>
  );
}
