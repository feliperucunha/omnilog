-- Drop Stripe column and index; add PayPal subscription ID
DROP INDEX IF EXISTS "User_stripeCustomerId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "stripeCustomerId";
ALTER TABLE "User" ADD COLUMN "paypalSubscriptionId" TEXT;
CREATE UNIQUE INDEX "User_paypalSubscriptionId_key" ON "User"("paypalSubscriptionId");
