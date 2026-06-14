import type { MarketListing } from "@geeklogs/shared";

export function marketListingDiscountPercent(listing: MarketListing): number | null {
  const previous = listing.previousPriceMinor;
  if (previous == null || previous <= listing.priceMinor) return null;
  return Math.round((1 - listing.priceMinor / previous) * 100);
}

export function marketListingHasDiscount(listing: MarketListing): boolean {
  return marketListingDiscountPercent(listing) != null;
}
