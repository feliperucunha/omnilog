import type { MarketListing } from "@geeklogs/shared";

export const marketSellerSelect = {
  id: true,
  username: true,
  email: true,
  phone: true,
  cityLabel: true,
} as const;

export function serializeMarketListing(row: {
  id: string;
  userId: string;
  logId: string;
  mediaType: string;
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
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    username: string | null;
    email: string;
    phone: string | null;
    cityLabel: string | null;
  };
}): MarketListing {
  return {
    id: row.id,
    userId: row.userId,
    logId: row.logId,
    mediaType: row.mediaType as MarketListing["mediaType"],
    externalId: row.externalId,
    title: row.title,
    image: row.image,
    priceMinor: row.priceMinor,
    priceCurrency: row.priceCurrency,
    previousPriceMinor: row.previousPriceMinor,
    description: row.description,
    acceptTrade: row.acceptTrade,
    localDelivery: row.localDelivery,
    shipsByMail: row.shipsByMail,
    contactEmail: row.contactEmail,
    contactWhatsapp: row.contactWhatsapp,
    city: row.city,
    cityLabel: row.cityLabel,
    country: row.country,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    seller: {
      id: row.user.id,
      username: row.user.username,
      email: row.user.email,
      phone: row.user.phone,
      cityLabel: row.user.cityLabel,
    },
  };
}
