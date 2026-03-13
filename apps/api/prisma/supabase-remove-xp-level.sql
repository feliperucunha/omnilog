-- Remove unused XP/level system.
-- Run in Supabase Dashboard → SQL Editor if you apply SQL manually (no Prisma migrate).
-- Safe to run: drops UserXp table and User.xpTotal / User.level columns.

DROP TABLE IF EXISTS "UserXp";

ALTER TABLE "User" DROP COLUMN IF EXISTS "xpTotal";
ALTER TABLE "User" DROP COLUMN IF EXISTS "level";
