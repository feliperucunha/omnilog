import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ItemImage } from "@/components/ItemImage";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { MarketListingSection } from "@/components/MarketListingSection";
import type { MarketListing } from "@geeklogs/shared";
import { minorToAmountString } from "@/lib/moneyInput";
import { marketListingDiscountPercent, marketListingHasDiscount } from "@/lib/marketListingDiscount";
import { minimalLogFromListing } from "@/lib/minimalLogFromListing";
import { paperShadow } from "@/lib/paperShadow";
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

function sellerProfilePath(listing: MarketListing): string {
  const handle = listing.seller.username?.trim() || listing.seller.id;
  return `/${handle}`;
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

type MarketListingDetailContentProps = {
  listing: MarketListing;
  t: TFunction;
  locale: string;
  currentUserId?: string;
  onListingUpdated?: (listing: MarketListing) => void;
  onDeleted?: () => void;
};

export function MarketListingDetailContent({
  listing,
  t,
  locale,
  currentUserId,
  onListingUpdated,
  onDeleted,
}: MarketListingDetailContentProps) {
  const isOwner = currentUserId != null && listing.userId === currentUserId;
  const price = `${minorToAmountString(listing.priceMinor, listing.priceCurrency)} ${listing.priceCurrency}`;
  const discountPercent = marketListingDiscountPercent(listing);
  const hasDiscount = marketListingHasDiscount(listing);
  const previousPrice =
    hasDiscount && listing.previousPriceMinor != null
      ? `${minorToAmountString(listing.previousPriceMinor, listing.priceCurrency)} ${listing.priceCurrency}`
      : null;

  const myLog = useMemo(
    () => (isOwner ? minimalLogFromListing(listing, currentUserId ?? listing.userId) : null),
    [isOwner, listing, currentUserId]
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <Card
        className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
        style={paperShadow}
      >
        <div className="flex gap-4">
          <div className="relative h-40 w-28 shrink-0 overflow-hidden rounded-lg sm:h-48 sm:w-36">
            <ItemImage
              src={listing.image}
              className="h-full w-full"
              mediaType={listing.mediaType}
            />
            {hasDiscount && discountPercent != null && (
              <span className="absolute left-1.5 top-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                {t("market.discountBadge", { percent: String(discountPercent) })}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="min-w-0 text-lg font-semibold text-[var(--color-lightest)] sm:text-xl">
              <OverflowMarquee>{listing.title}</OverflowMarquee>
            </h1>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <p className="text-base font-semibold tabular-nums text-[var(--btn-gradient-start)] sm:text-lg">
                {price}
              </p>
              {previousPrice && (
                <p className="text-sm tabular-nums text-[var(--color-light)] line-through">{previousPrice}</p>
              )}
            </div>
            {listing.acceptTrade && (
              <p className="mt-2 text-sm text-[var(--color-light)]">{t("market.acceptsTrade")}</p>
            )}
            {(listing.localDelivery || listing.shipsByMail) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {listing.localDelivery && (
                  <p className="text-sm text-[var(--color-light)]">{t("market.offersLocalDelivery")}</p>
                )}
                {listing.shipsByMail && (
                  <p className="text-sm text-[var(--color-light)]">{t("market.shipsByMail")}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <dl className="mt-4 grid gap-3 border-t border-[var(--color-surface-border)] pt-4 text-sm">
          <div>
            <dt className="text-[var(--color-light)]">{t("market.seller")}</dt>
            <dd>
              <Link
                to={sellerProfilePath(listing)}
                className="text-blue-500 underline-offset-2 hover:text-blue-400 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                {sellerName(listing)}
              </Link>
            </dd>
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

        {!isOwner && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-surface-border)] pt-4">
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
      </Card>

      {isOwner && myLog && (
        <Card
          className="border-[var(--color-surface-border)] bg-[var(--color-dark)] p-4"
          style={paperShadow}
        >
          <h2 className="mb-4 text-base font-semibold text-[var(--color-lightest)]">
            {t("market.editListing")}
          </h2>
          <MarketListingSection
            mediaType={listing.mediaType}
            externalId={listing.externalId}
            title={listing.title}
            image={listing.image}
            myLog={myLog}
            onEnsureLog={async () => myLog}
            prefilledListing={listing}
            stayOnPage
            onSaved={onListingUpdated}
            onDeleted={onDeleted}
          />
        </Card>
      )}
    </div>
  );
}
