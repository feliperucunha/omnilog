-- Add subscription end date for Pro (used when cancelled and for cron to revoke access)
ALTER TABLE "User" ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);
