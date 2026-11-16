import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { Card } from "@/components/ui/card";
import { ItemImage } from "@/components/ItemImage";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import type { MarketListing } from "@geeklogs/shared";
import { minorToAmountString } from "@/lib/moneyInput";
import { marketListingDiscountPercent, marketListingHasDiscount } from "@/lib/marketListingDiscount";
import { marketListingPath } from "@/lib/marketListingRoutes";
import { cn } from "@/lib/utils";
import type { TFunction } from "@/contexts/LocaleContext";

const cardShadow: CSSProperties = { boxShadow: "var(--shadow-card)" };

function formatListingDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
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

export function MarketListingCard({
  listing,
  t,
  locale,
}: {
  listing: MarketListing;
  t: TFunction;
  locale: string;
}) {
  const price = `${minorToAmountString(listing.priceMinor, listing.priceCurrency)} ${listing.priceCurrency}`;
  const discountPercent = marketListingDiscountPercent(listing);
  const hasDiscount = marketListingHasDiscount(listing);
  const previousPrice =
    hasDiscount && listing.previousPriceMinor != null
      ? `${minorToAmountString(listing.previousPriceMinor, listing.priceCurrency)} ${listing.priceCurrency}`
      : null;
  const descriptionPreview =
    listing.description.length > 80
      ? `${listing.description.slice(0, 80).trim()}…`
      : listing.description;

  return (
    <Card
      className="relative grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-[var(--color-surface-border)] bg-[var(--color-dark)] p-2.5 shadow-[var(--shadow-sm)] max-md:grid-cols-[64px_minmax(0,1fr)]"
      style={cardShadow}
    >
      <Link to={marketListingPath(listing.id)} className="relative block overflow-hidden">
        <ItemImage
          src={listing.image}
          className="h-24 w-[72px] overflow-hidden rounded-[10px] max-md:w-16"
          mediaType={listing.mediaType}
        />
        {hasDiscount && discountPercent != null && (
          <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
            {t("market.discountBadge", { percent: String(discountPercent) })}
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-col gap-1">
        <Link
          to={marketListingPath(listing.id)}
          className="block min-w-0 text-left font-semibold text-[var(--color-lightest)] hover:underline"
        >
          <OverflowMarquee className="text-base leading-snug">{listing.title}</OverflowMarquee>
        </Link>
        <p className="truncate text-[13px] text-[var(--color-light)]">
          {t("market.seller")}: {sellerName(listing)}
        </p>
        {listing.acceptTrade && (
          <span className="inline-flex w-fit rounded bg-[var(--color-mid)]/40 px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-lightest)]">
            {t("market.acceptsTrade")}
          </span>
        )}
        {(listing.localDelivery || listing.shipsByMail) && (
          <div className="flex flex-wrap gap-1">
            {listing.localDelivery && (
              <span className="inline-flex w-fit rounded bg-[var(--color-mid)]/40 px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-lightest)]">
                {t("market.offersLocalDelivery")}
              </span>
            )}
            {listing.shipsByMail && (
              <span className="inline-flex w-fit rounded bg-[var(--color-mid)]/40 px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-lightest)]">
                {t("market.shipsByMail")}
              </span>
            )}
          </div>
        )}
        <p className="line-clamp-2 text-[10px] leading-snug text-[var(--color-light)]">
          {descriptionPreview}
        </p>
        <p className="truncate text-[9px] text-[var(--color-light)]">
          {formatListingDate(listing.createdAt, locale)} · {listing.cityLabel}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 max-md:col-start-2">
        <p className="font-[family-name:var(--font-display)] text-[22px] leading-none text-[var(--color-lightest)]">{price}</p>
        {previousPrice ? (
          <p className="text-[13px] tabular-nums text-[var(--color-light)] line-through">{previousPrice}</p>
        ) : null}
        <div className="flex items-center justify-end gap-1">
        {listing.contactEmail && (
          <a
            href={mailHref(listing)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-light)]",
              "hover:bg-[var(--color-mid)]/40 hover:text-[var(--color-lightest)]"
            )}
            aria-label={t("market.contactEmail")}
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
        {listing.contactWhatsapp && listing.seller.phone && (
          <a
            href={whatsappHref(listing.seller.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              "hover:bg-[var(--color-mid)]/40"
            )}
            aria-label={t("market.contactWhatsapp")}
            onClick={(e) => e.stopPropagation()}
          >
            <WhatsAppIcon className="h-3.5 w-3.5" />
          </a>
        )}
        </div>
      </div>
    </Card>
  );
}
