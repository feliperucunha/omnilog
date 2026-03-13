-- Add login tracking to User for admin dashboard
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
