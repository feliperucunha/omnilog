ALTER TABLE "Log" ADD COLUMN "expansionOfExternalId" TEXT,
ADD COLUMN "expansionOfTitle" TEXT;

ALTER TABLE "BoardGameMatch" ADD COLUMN "expansions" TEXT;
