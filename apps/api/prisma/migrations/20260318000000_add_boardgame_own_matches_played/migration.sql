-- Add boardgame-specific fields: own (boolean) and matchesPlayed (integer)
ALTER TABLE "Log" ADD COLUMN "own" BOOLEAN;
ALTER TABLE "Log" ADD COLUMN "matchesPlayed" INTEGER;
