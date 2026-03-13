-- Remove unused XP/level system: grantXp() is never called; User.xpTotal and User.level are never read.
-- Reviewer level comes from UserReviewStats.totalReviews via reviewerLevel.service.

-- Drop UserXp table (no longer written or read)
DROP TABLE IF EXISTS "UserXp";

-- Remove XP/level columns from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "xpTotal";
ALTER TABLE "User" DROP COLUMN IF EXISTS "level";
