-- Track when monetary spend fields last changed so stats can attribute spend to the right calendar period.
ALTER TABLE "Log" ADD COLUMN "spendFieldsAt" TIMESTAMP(3);

UPDATE "Log"
SET "spendFieldsAt" = "updatedAt"
WHERE (
  ("purchaseAmountMinor" IS NOT NULL AND "purchaseCurrency" IS NOT NULL)
  OR ("saleAmountMinor" IS NOT NULL AND "saleCurrency" IS NOT NULL)
);
