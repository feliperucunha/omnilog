import type { MediaType } from "./types.js";

export const MARKET_MEDIA_TYPES = ["boardgames", "books", "manga", "comics"] as const;

export type MarketMediaType = (typeof MARKET_MEDIA_TYPES)[number];

export function isMarketMediaType(value: string): value is MarketMediaType {
  return (MARKET_MEDIA_TYPES as readonly string[]).includes(value);
}

export type MarketListing = {
  id: string;
  userId: string;
  logId: string;
  mediaType: MarketMediaType;
  externalId: string;
  title: string;
  image: string | null;
  priceMinor: number;
  priceCurrency: string;
  previousPriceMinor: number | null;
  description: string;
  acceptTrade: boolean;
  localDelivery: boolean;
  shipsByMail: boolean;
  contactEmail: boolean;
  contactWhatsapp: boolean;
  city: string;
  cityLabel: string;
  country: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  seller: {
    id: string;
    username: string | null;
    email: string;
    phone: string | null;
    cityLabel: string | null;
  };
};

export type MarketListingsResponse = {
  data: MarketListing[];
  nextCursor: string | null;
};

export type CreateMarketListingInput = {
  logId: string;
  priceMinor: number;
  priceCurrency: string;
  description: string;
  acceptTrade: boolean;
  localDelivery: boolean;
  shipsByMail: boolean;
  contactEmail: boolean;
  contactWhatsapp: boolean;
  phone?: string;
};

export type CitySuggestion = {
  id: string;
  label: string;
  city: string;
  country: string | null;
  countryCode: string | null;
};

export type MyMarketListedLogIdsResponse = {
  data: string[];
};
