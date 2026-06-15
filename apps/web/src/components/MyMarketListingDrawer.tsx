import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ItemImage } from "@/components/ItemImage";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { MarketListingSection } from "@/components/MarketListingSection";
import type { MarketListing } from "@geeklogs/shared";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { minimalLogFromListing } from "@/lib/minimalLogFromListing";

type MyMarketListingDrawerProps = {
  listing: MarketListing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (listing: MarketListing) => void;
  onDeleted?: (listingId: string) => void;
};

function MyMarketListingBody({
  listing,
  onClose,
  onSaved,
  onDeleted,
}: {
  listing: MarketListing;
  onClose: () => void;
  onSaved?: (listing: MarketListing) => void;
  onDeleted?: (listingId: string) => void;
}) {
  const { t } = useLocale();
  const { me } = useMe();
  const myLog = useMemo(
    () => minimalLogFromListing(listing, me?.user.id ?? listing.userId),
    [listing, me?.user.id]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg">
          <ItemImage
            src={listing.image}
            className="h-full w-full"
            mediaType={listing.mediaType}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="min-w-0 text-base font-semibold text-[var(--color-lightest)]">
            <OverflowMarquee>{listing.title}</OverflowMarquee>
          </h2>
          <p className="mt-1 text-xs text-[var(--color-light)]">{t("market.updateListingHint")}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-[var(--color-light)]"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>
      <MarketListingSection
        mediaType={listing.mediaType}
        externalId={listing.externalId}
        title={listing.title}
        image={listing.image}
        myLog={myLog}
        onEnsureLog={async () => myLog}
        prefilledListing={listing}
        stayOnPage
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    </div>
  );
}

export function MyMarketListingDrawer({
  listing,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: MyMarketListingDrawerProps) {
  const isMobile = useIsMobile();
  if (!listing) return null;

  const handleDeleted = (listingId: string) => {
    onDeleted?.(listingId);
    onOpenChange(false);
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh] overflow-y-auto px-4 pb-6 pt-2">
          <MyMarketListingBody
            listing={listing}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
            onDeleted={handleDeleted}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-[var(--color-surface-border)] bg-[var(--color-dark)]">
        <DialogHeader className="sr-only">
          <DialogTitle>{listing.title}</DialogTitle>
        </DialogHeader>
        <MyMarketListingBody
          listing={listing}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
          onDeleted={handleDeleted}
        />
      </DialogContent>
    </Dialog>
  );
}
