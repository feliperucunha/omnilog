-- CreateEnum
CREATE TYPE "BadgeMedium" AS ENUM ('MOVIE', 'TV_SHOW', 'ANIME', 'MANGA', 'COMIC', 'BOOK');
CREATE TYPE "BadgeRarity" AS ENUM ('common', 'rare', 'epic', 'legendary');
CREATE TYPE "BadgeConditionType" AS ENUM ('FIRST_REVIEW', 'REVIEW_COUNT_PER_MEDIA', 'REVIEW_COUNT_GLOBAL', 'MEDIA_TYPES_REVIEWED', 'REVIEW_LIKES', 'REVIEW_STREAK');

-- AlterTable User: gamification fields
ALTER TABLE "User" ADD COLUMN "xpTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN "currentStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastReviewDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "selectedBadgeIds" TEXT;

-- CreateTable Badge
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "medium" "BadgeMedium",
    "rarity" "BadgeRarity" NOT NULL DEFAULT 'common',
    "conditionType" "BadgeConditionType" NOT NULL,
    "conditionValue" INTEGER NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserBadge
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");
CREATE INDEX "UserBadge_badgeId_idx" ON "UserBadge"("badgeId");

-- CreateTable UserXp
CREATE TABLE "UserXp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserXp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserXp_userId_idx" ON "UserXp"("userId");

-- CreateTable UserReviewStats
CREATE TABLE "UserReviewStats" (
    "userId" TEXT NOT NULL,
    "movieReviews" INTEGER NOT NULL DEFAULT 0,
    "tvShowReviews" INTEGER NOT NULL DEFAULT 0,
    "animeReviews" INTEGER NOT NULL DEFAULT 0,
    "mangaReviews" INTEGER NOT NULL DEFAULT 0,
    "comicReviews" INTEGER NOT NULL DEFAULT 0,
    "bookReviews" INTEGER NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "distinctMediaReviewed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserReviewStats_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserXp" ADD CONSTRAINT "UserXp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserReviewStats" ADD CONSTRAINT "UserReviewStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
