-- =============================================================================
-- Supabase SQL: Scalability & schema alignment
-- Run this in Supabase Dashboard → SQL Editor (run the whole script at once).
-- Safe to run multiple times: duplicate index names will error; ignore or use
-- "CREATE INDEX IF NOT EXISTS" (Postgres 9.5+).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Composite indexes for hot paths (thousands of users × thousands of logs)
-- -----------------------------------------------------------------------------

-- Logs list: GET /logs?mediaType=... — filter by userId (+ mediaType), order by updatedAt
-- Avoids sort and speeds up "my logs" and "my logs in this category".
CREATE INDEX IF NOT EXISTS "Log_userId_mediaType_updatedAt_idx"
  ON "Log" ("userId", "mediaType", "updatedAt" DESC);

-- Item page reviews: GET /items/:mediaType/:externalId — filter by (mediaType, externalId), order by createdAt, paginated
-- Speeds up review list and pagination.
CREATE INDEX IF NOT EXISTS "Log_mediaType_externalId_createdAt_idx"
  ON "Log" ("mediaType", "externalId", "createdAt" DESC);

-- -----------------------------------------------------------------------------
-- Notes:
-- - Existing indexes (userId), (userId, mediaType), (mediaType, externalId)
--   and unique (userId, mediaType, externalId) are already optimal for
--   lookups; the two above add ordering for list/review queries.
-- - For zero-downtime on a live DB, run each as:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "..." ON "Log" (...);
--   (one statement per run; CONCURRENTLY cannot run inside a transaction.)
-- -----------------------------------------------------------------------------
