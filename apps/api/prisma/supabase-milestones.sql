-- Milestone table for badge/milestone progress (reviews and logs).
-- Run this in Supabase Dashboard → SQL Editor → New query → Run.
--
-- If you get an error about "BadgeMedium" type not existing, run this first (then run the rest):
--   CREATE TYPE "BadgeMedium" AS ENUM ('MOVIE', 'TV_SHOW', 'ANIME', 'MANGA', 'COMIC', 'BOOK');
--
-- After this, restart your API so it can seed milestone rows (dashboard badge meter will then work).

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "Milestone" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "medium" "BadgeMedium",
    "threshold" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- Indexes (idempotent; ignore if already exist)
CREATE UNIQUE INDEX IF NOT EXISTS "Milestone_metric_scope_medium_threshold_key"
  ON "Milestone"("metric", "scope", "medium", "threshold");

CREATE INDEX IF NOT EXISTS "Milestone_metric_scope_idx"
  ON "Milestone"("metric", "scope");
