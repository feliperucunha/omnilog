-- Replace PayPal with Ko-fi: drop paypalSubscriptionId, add kofiLinkCode
DROP INDEX IF EXISTS "User_paypalSubscriptionId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "paypalSubscriptionId";
ALTER TABLE "User" ADD COLUMN "kofiLinkCode" TEXT;
CREATE UNIQUE INDEX "User_kofiLinkCode_key" ON "User"("kofiLinkCode");
