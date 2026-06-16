import { getPublicWebOrigin } from "@/lib/publicWebOrigin";

export function marketListingPath(listingId: string): string {
  return `/market/listing/${encodeURIComponent(listingId)}`;
}

export function marketListingShareUrl(listingId: string): string {
  const base = getPublicWebOrigin().replace(/\/$/, "");
  return `${base}${marketListingPath(listingId)}`;
}
