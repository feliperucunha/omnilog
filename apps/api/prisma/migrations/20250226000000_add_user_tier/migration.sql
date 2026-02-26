-- Add tier to User: free (500 log cap) or pro (unlimited + export).
ALTER TABLE "User" ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'free';
