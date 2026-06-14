import { useState } from "react";
import { Mail, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
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
import { MarketDeleteListingConfirmDialog } from "@/components/MarketDeleteListingConfirmDialog";
import type { MarketListing } from "@geeklogs/shared";
import { minorToAmountString } from "@/lib/moneyInput";
import { marketListingDiscountPercent, marketListingHasDiscount } from "@/lib/marketListingDiscount";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useMe } from "@/contexts/MeContext";
import type { TFunction } from "@/contexts/LocaleContext";

function formatListingDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function sellerName(listing: MarketListing): string {
  return listing.seller.username?.trim() || listing.seller.email.split("@")[0] || "—";
}

function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

function mailHref(listing: MarketListing): string {
  const subject = encodeURIComponent(`Geeklogs Market: ${listing.title}`);
  const body = encodeURIComponent(
    `Hi,\n\nI'm interested in your listing "${listing.title}" on Geeklogs Market.\n`
  );
  return `mailto:${listing.seller.email}?subject=${subject}&body=${body}`;
}

function MarketListingBody({
  listing,
  t,
  locale,
  onClose,
  currentUserId,
  onDeleted,
}: {
  listing: MarketListing;
  t: TFunction;
  locale: string;
  onClose: () => void;
  currentUserId?: string;
  onDeleted?: (listingId: string) => void;
}) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const isOwner = currentUserId != null && listing.userId === currentUserId;
  const price = `${minorToAmountString(listing.priceMinor, listing.priceCurrency)} ${listing.priceCurrency}`;
  const discountPercent = marketListingDiscountPercent(listing);
  const hasDiscount = marketListingHasDiscount(listing);
  const previousPrice =
    hasDiscount && listing.previousPriceMinor != null
      ? `${minorToAmountString(listing.previousPriceMinor, listing.priceCurrency)} ${listing.priceCurrency}`
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg">
          <ItemImage
            src={listing.image}
            className="h-full w-full"
            mediaType={listing.mediaType}
          />
          {hasDiscount && discountPercent != null && (
            <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
              {t("market.discountBadge", { percent: String(discountPercent) })}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="min-w-0 text-lg font-semibold text-[var(--color-lightest)]">
            <OverflowMarquee>{listing.title}</OverflowMarquee>
          </h2>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className="text-sm font-semibold tabular-nums text-[var(--btn-gradient-start)]">{price}</p>
            {previousPrice && (
              <p className="text-xs tabular-nums text-[var(--color-light)] line-through">{previousPrice}</p>
            )}
          </div>
          {listing.acceptTrade && (
            <p className="mt-1 text-xs text-[var(--color-light)]">{t("market.acceptsTrade")}</p>
          )}
          {(listing.localDelivery || listing.shipsByMail) && (
            <div className="mt-1 flex flex-wrap gap-2">
              {listing.localDelivery && (
                <p className="text-xs text-[var(--color-light)]">{t("market.offersLocalDelivery")}</p>
              )}
              {listing.shipsByMail && (
                <p className="text-xs text-[var(--color-light)]">{t("market.shipsByMail")}</p>
              )}
            </div>
          )}
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

      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-[var(--color-light)]">{t("market.seller")}</dt>
          <dd className="text-[var(--color-lightest)]">{sellerName(listing)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-light)]">{t("market.listedOn")}</dt>
          <dd className="text-[var(--color-lightest)]">
            {formatListingDate(listing.createdAt, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-light)]">{t("market.location")}</dt>
          <dd className="text-[var(--color-lightest)]">{listing.cityLabel}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-light)]">{t("market.description")}</dt>
          <dd className="whitespace-pre-wrap text-[var(--color-lightest)]">{listing.description}</dd>
        </div>
      </dl>

      {isOwner ? (
        <Button
          type="button"
          variant="ghost"
          className="text-red-400 hover:bg-red-500/20 hover:text-red-400"
          onClick={() => setConfirmDeleteOpen(true)}
        >
          {t("market.deleteListing")}
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {listing.contactEmail && (
            <Button type="button" variant="secondary" asChild>
              <a href={mailHref(listing)}>
                <Mail className="mr-2 h-4 w-4" aria-hidden />
                {t("market.contactEmail")}
              </a>
            </Button>
          )}
          {listing.contactWhatsapp && listing.seller.phone && (
            <Button type="button" variant="secondary" asChild>
              <a href={whatsappHref(listing.seller.phone)} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="mr-2 h-4 w-4" />
                {t("market.contactWhatsapp")}
              </a>
            </Button>
          )}
        </div>
      )}
      {isOwner && (
        <MarketDeleteListingConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          listingId={listing.id}
          onDeleted={() => onDeleted?.(listing.id)}
        />
      )}
    </div>
  );
}

export function MarketListingDrawer({
  listing,
  open,
  onOpenChange,
  t,
  locale,
  onDeleted,
}: {
  listing: MarketListing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: TFunction;
  locale: string;
  onDeleted?: (listingId: string) => void;
}) {
  const isMobile = useIsMobile();
  const { me } = useMe();
  const currentUserId = me?.user.id;
  if (!listing) return null;

  const handleDeleted = (listingId: string) => {
    onDeleted?.(listingId);
    onOpenChange(false);
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90dvh] overflow-y-auto px-4 pb-6 pt-2">
          <MarketListingBody
            listing={listing}
            t={t}
            locale={locale}
            onClose={() => onOpenChange(false)}
            currentUserId={currentUserId}
            onDeleted={handleDeleted}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--color-surface-border)] bg-[var(--color-dark)]">
        <DialogHeader className="sr-only">
          <DialogTitle>{listing.title}</DialogTitle>
        </DialogHeader>
        <MarketListingBody
          listing={listing}
          t={t}
          locale={locale}
          onClose={() => onOpenChange(false)}
          currentUserId={currentUserId}
          onDeleted={handleDeleted}
        />
      </DialogContent>
    </Dialog>
  );
}
