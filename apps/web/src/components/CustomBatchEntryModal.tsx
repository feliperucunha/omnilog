import { useState, useRef, useCallback, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CustomEntryForm, type CustomEntryFormHandle } from "@/components/CustomEntryForm";
import { BatchEntryTab } from "@/components/BatchEntryTab";
import { BoardGameCollectionImportPanel } from "@/components/BoardGameCollectionImportPanel";
import { useLocale } from "@/contexts/LocaleContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import type { MediaType } from "@geeklogs/shared";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { cn } from "@/lib/utils";

const CUSTOM_ENTRY_FORM_ID = "custom-entry-drawer-form";

type Tab = "custom" | "batch" | "bggImport" | "ludopediaImport";

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
  const isBg = mediaType === "boardgames";
  return (
    <div
      className="mb-3 flex shrink-0 flex-col gap-1.5 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-1.5 sm:mb-4"
    >
      <div className="grid grid-cols-2 gap-1">
        <button type="button" onClick={() => setTab("custom")} className={tabClass(tab === "custom")}>
          {t("customEntry.tabCustom")}
        </button>
        <button type="button" onClick={() => setTab("batch")} className={tabClass(tab === "batch")}>
          {t("customEntry.tabBatch")}
        </button>
      </div>
      {isBg ? (
        <div className="grid grid-cols-2 gap-1">
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
      ) : null}
    </div>
  );
}

export function CustomBatchEntryModal({ mediaType, onSaved, onCancel }: CustomBatchEntryModalProps) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("custom");
  const [batchFooter, setBatchFooter] = useState<ReactNode>(null);
  const [importRunning, setImportRunning] = useState(false);
  const isMobile = useIsMobile();
  const drawerRequestCloseRef = useRef<(() => void) | null>(null);
  const customFormRefDesktop = useRef<CustomEntryFormHandle | null>(null);

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
    if (tab === "bggImport" || tab === "ludopediaImport" || tab === "batch") {
      onCancel();
      return;
    }
    if (tab === "custom") {
      const h = customFormRefDesktop.current;
      if (!h || h.canDismissWithoutSave()) {
        onCancel();
        return;
      }
      void h.trySubmit({ optimisticClose: true });
    }
  }, [importRunning, tab, onCancel]);

  const importPanel = (source: "bgg" | "ludopedia") => (
    <BoardGameCollectionImportPanel
      source={source}
      showDuplicateModeToggle
      onPhaseChange={(ph) => setImportRunning(ph === "running")}
      onBack={() => setTab("custom")}
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
            {tab === "custom" ? (
              <CustomEntryForm
                embedded
                buttonsInFooter
                formId={CUSTOM_ENTRY_FORM_ID}
                mediaType={mediaType}
                onSaved={onSaved}
                onCancel={handleDrawerClose}
              />
            ) : tab === "batch" ? (
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
            {tab === "custom" ? (
              <div className="flex w-full gap-4">
                <Button type="button" variant="outline" className="flex-1" onClick={handleDrawerClose} disabled={importRunning}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" form={CUSTOM_ENTRY_FORM_ID} className="flex-1" disabled={importRunning}>
                  {t("common.save")}
                </Button>
              </div>
            ) : tab === "batch" ? (
              batchFooter
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  const modalContent = (
    <>
      <CustomBatchEntryModalTabs mediaType={mediaType} tab={tab} setTab={setTab} t={t} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "custom" ? (
          <CustomEntryForm
            ref={customFormRefDesktop}
            embedded
            suppressActionButtons
            mediaType={mediaType}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        ) : tab === "batch" ? (
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
