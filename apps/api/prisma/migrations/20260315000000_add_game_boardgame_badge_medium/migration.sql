-- Add GAME and BOARD_GAME to BadgeMedium enum (for games and boardgames badge meter)
ALTER TYPE "BadgeMedium" ADD VALUE IF NOT EXISTS 'GAME';
ALTER TYPE "BadgeMedium" ADD VALUE IF NOT EXISTS 'BOARD_GAME';

-- Add per-medium review counts for games and boardgames
ALTER TABLE "UserReviewStats" ADD COLUMN IF NOT EXISTS "gameReviews" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserReviewStats" ADD COLUMN IF NOT EXISTS "boardGameReviews" INTEGER NOT NULL DEFAULT 0;
