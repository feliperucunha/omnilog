-- AlterTable (User)
ALTER TABLE "User" ADD COLUMN     "ludopediaApiToken" TEXT,
ADD COLUMN     "boardGameProvider" TEXT;

-- AlterTable (Log: which board game API the externalId came from)
ALTER TABLE "Log" ADD COLUMN     "boardGameSource" TEXT;
