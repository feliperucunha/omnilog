-- =============================================================================
-- Supabase: enable Row Level Security on all public Prisma tables
-- =============================================================================
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
--
-- Why: Supabase exposes the `public` schema via the Data API (PostgREST).
-- Without RLS, anyone with the project anon key could SELECT/INSERT/UPDATE
-- tables — including "User"."password" and API keys stored on User.
--
-- With RLS enabled and no policies for `anon` / `authenticated`, those roles
-- cannot access rows (deny-by-default). Your Node API uses Prisma with the
-- direct Postgres connection (role `postgres`), which bypasses RLS on Supabase,
-- so existing API behavior is unchanged.
--
-- If you later use Supabase Auth + client-side queries, add explicit policies
-- for role `authenticated` (never expose password hashes via policies).
--
-- Optional extra hardening: Dashboard → Settings → API → consider restricting
-- which schemas are exposed if you only ever use Prisma (not documented here).
-- =============================================================================

ALTER TABLE IF EXISTS "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Badge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "UserBadge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "UserReviewStats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Follow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Milestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "LogReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
