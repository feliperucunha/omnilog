-- Row Level Security: blocks Supabase PostgREST (anon / authenticated JWT roles)
-- from reading or writing these tables. The app uses Prisma with the database
-- owner (postgres on Supabase), which bypasses RLS, so the API keeps working.
-- Run in Supabase SQL Editor if you manage the DB manually: see supabase-rls.sql

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Badge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBadge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserReviewStats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Follow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Milestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LogReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
