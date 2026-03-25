-- Boardgames: user wants to purchase a copy (independent from `own`).
ALTER TABLE "Log" ADD COLUMN "wantToBuy" BOOLEAN;
