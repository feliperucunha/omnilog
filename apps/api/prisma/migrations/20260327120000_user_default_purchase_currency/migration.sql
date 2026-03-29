-- Last ISO 4217 currency used when saving a purchase amount (default for next spend input).
ALTER TABLE "User" ADD COLUMN "defaultPurchaseCurrency" TEXT;
