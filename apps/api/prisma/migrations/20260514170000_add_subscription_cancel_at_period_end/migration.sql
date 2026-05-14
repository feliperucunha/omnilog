-- Tracks Stripe `cancel_at_period_end` so the UI can show "ends on X" + upgrade options
-- while the user still has Pro access through the end of the paid period.
ALTER TABLE "User" ADD COLUMN "subscriptionCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- "monthly" | "yearly" — current cadence; used so the FE can default the interval toggle.
ALTER TABLE "User" ADD COLUMN "subscriptionInterval" TEXT;
