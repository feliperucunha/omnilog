import { useState, useRef, useCallback, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CustomEntryForm } from "@/components/CustomEntryForm";
import { BatchEntryTab } from "@/components/BatchEntryTab";
import { useLocale } from "@/contexts/LocaleContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import type { MediaType } from "@geeklogs/shared";
import type { LogCompleteState } from "@/components/ItemReviewForm";
import { cn } from "@/lib/utils";

const CUSTOM_ENTRY_FORM_ID = "custom-entry-drawer-form";

type Tab = "custom" | "batch";

interface CustomBatchEntryModalProps {
  mediaType: MediaType;
  onSaved: (completion?: LogCompleteState) => void;
  onCancel: () => void;
}

const tabButtons = (
  tab: Tab,
  setTab: (t: Tab) => void,
  t: (key: string) => string
) => (
  <div className="mb-3 shrink-0 flex gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-1 sm:mb-4">
    <button
      type="button"
      onClick={() => setTab("custom")}
      className={cn(
        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        tab === "custom"
          ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
          : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
      )}
    >
      {t("customEntry.tabCustom")}
    </button>
    <button
      type="button"
      onClick={() => setTab("batch")}
      className={cn(
        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        tab === "batch"
          ? "bg-[var(--color-mid)]/50 text-[var(--color-lightest)]"
          : "text-[var(--color-light)] hover:text-[var(--color-lightest)]"
      )}
    >
      {t("customEntry.tabBatch")}
    </button>
  </div>
);

const modalContent = (
  tab: Tab,
  setTab: (t: Tab) => void,
  t: (key: string) => string,
  mediaType: MediaType,
  onSaved: (completion?: LogCompleteState) => void,
  onCancel: () => void
) => (
  <>
    {tabButtons(tab, setTab, t)}
    <div className="min-h-0 flex-1 overflow-y-auto">
      {tab === "custom" ? (
        <CustomEntryForm
          embedded
          mediaType={mediaType}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      ) : (
        <BatchEntryTab initialMediaType={mediaType} onDone={onSaved} onCancel={onCancel} />
      )}
    </div>
  </>
);

export function CustomBatchEntryModal({
  mediaType,
  onSaved,
  onCancel,
}: CustomBatchEntryModalProps) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("custom");
  const [batchFooter, setBatchFooter] = useState<ReactNode>(null);
  const isMobile = useIsMobile();
  const drawerRequestCloseRef = useRef<(() => void) | null>(null);
  const handleDrawerClose = useCallback(() => {
    drawerRequestCloseRef.current?.() ?? onCancel();
  }, [onCancel]);

  const content = modalContent(
    tab,
    setTab,
    t,
    mediaType,
    onSaved,
    isMobile ? handleDrawerClose : onCancel
  );

  if (isMobile) {
    return (
      <Drawer open modal={false} onOpenChange={(open) => !open && onCancel()}>
        <DrawerContent
          onClose={onCancel}
          onReady={(requestClose) => {
            drawerRequestCloseRef.current = requestClose;
          }}
          mobileHeight="95%"
          className="flex max-h-[85dvh] w-full max-w-lg flex-col gap-0 overflow-hidden p-4 sm:p-6"
        >
          <div className="mt-6">
            {tabButtons(tab, setTab, t)}
            {tab === "custom" ? (
              <CustomEntryForm
                embedded
                buttonsInFooter
                formId={CUSTOM_ENTRY_FORM_ID}
                mediaType={mediaType}
                onSaved={onSaved}
                onCancel={handleDrawerClose}
              />
            ) : (
              <BatchEntryTab
                initialMediaType={mediaType}
                onDone={onSaved}
                onCancel={handleDrawerClose}
                renderFooterOutside
                onFooterChange={setBatchFooter}
              />
            )}
          </div>
          <DrawerFooter>
            {tab === "custom" ? (
              <div className="flex gap-4 w-full">
                <Button type="button" variant="outline" className="flex-1" onClick={handleDrawerClose}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" form={CUSTOM_ENTRY_FORM_ID} className="flex-1" disabled={false}>
                  {t("common.save")}
                </Button>
              </div>
            ) : (
              batchFooter
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open modal={false} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        onClose={onCancel}
        className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-4 sm:p-6"
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
