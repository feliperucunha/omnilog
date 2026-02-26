-- CreateEnum: Tier with values free and pro
CREATE TYPE "Tier" AS ENUM ('free', 'pro');

-- AlterTable: User.tier from TEXT to Tier enum (existing values 'free' or 'pro' are valid)
ALTER TABLE "User" ALTER COLUMN "tier" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "tier" TYPE "Tier" USING (
  CASE WHEN "tier" = 'pro' THEN 'pro'::"Tier" ELSE 'free'::"Tier" END
);
ALTER TABLE "User" ALTER COLUMN "tier" SET DEFAULT 'free'::"Tier";
