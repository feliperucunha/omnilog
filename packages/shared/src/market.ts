import type { SearchSortOption } from "./types.js";

export const MARKET_MEDIA_TYPES = ["boardgames", "books", "manga", "comics"] as const;

export type MarketMediaType = (typeof MARKET_MEDIA_TYPES)[number];

export function isMarketMediaType(value: string): value is MarketMediaType {
  return (MARKET_MEDIA_TYPES as readonly string[]).includes(value);
}

export const MARKET_SORT_VALUES = [
  "relevance",
  "listed_desc",
  "listed_asc",
  "price_asc",
  "price_desc",
  "deals_desc",
  "title_asc",
  "title_desc",
  "updated_desc",
] as const;

export type MarketSortValue = (typeof MARKET_SORT_VALUES)[number];

export const MARKET_SORT_OPTIONS: readonly SearchSortOption[] = [
  { value: "relevance", labelKey: "searchSort.relevance" },
  { value: "listed_desc", labelKey: "marketSort.listedNewest" },
  { value: "listed_asc", labelKey: "marketSort.listedOldest" },
  { value: "price_asc", labelKey: "marketSort.priceLowest" },
  { value: "price_desc", labelKey: "marketSort.priceHighest" },
  { value: "deals_desc", labelKey: "marketSort.deals" },
  { value: "title_asc", labelKey: "searchSort.titleAsc" },
  { value: "title_desc", labelKey: "searchSort.titleDesc" },
  { value: "updated_desc", labelKey: "marketSort.recentlyUpdated" },
];

export const DEFAULT_MARKET_SORT: MarketSortValue = "listed_desc";

export function isMarketSortValue(value: string): value is MarketSortValue {
  return (MARKET_SORT_VALUES as readonly string[]).includes(value);
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

export type CountrySuggestion = {
  id: string;
  label: string;
  country: string;
};

export type MarketLocationFilter =
  | { type: "city"; city: string; label: string }
  | { type: "country"; country: string; label: string };

export type MarketLocationsResponse = {
  data: {
    cities: { city: string; label: string }[];
    countries: { country: string }[];
  };
};

export type MyMarketListedLogIdsResponse = {
  data: string[];
};
