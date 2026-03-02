-- Replace Ko-fi with PayPal: drop kofiLinkCode, add paypalSubscriptionId
DROP INDEX IF EXISTS "User_kofiLinkCode_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "kofiLinkCode";
ALTER TABLE "User" ADD COLUMN "paypalSubscriptionId" TEXT;
CREATE UNIQUE INDEX "User_paypalSubscriptionId_key" ON "User"("paypalSubscriptionId");
