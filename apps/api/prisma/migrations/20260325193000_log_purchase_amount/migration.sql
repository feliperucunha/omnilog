-- Optional purchase amount for spend tracking (minor units + ISO 4217 currency).
ALTER TABLE "Log" ADD COLUMN "purchaseAmountMinor" INTEGER;
ALTER TABLE "Log" ADD COLUMN "purchaseCurrency" TEXT;
