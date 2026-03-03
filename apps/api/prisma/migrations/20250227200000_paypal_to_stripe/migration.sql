-- Replace PayPal with Stripe: drop paypalSubscriptionId, add stripeSubscriptionId
DROP INDEX IF EXISTS "User_paypalSubscriptionId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "paypalSubscriptionId";
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT;
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
