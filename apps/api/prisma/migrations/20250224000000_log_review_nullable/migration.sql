-- Ensure Log.review accepts NULL (optional field; only stars are required).
-- Safe to run even if the column is already nullable.
ALTER TABLE "Log" ALTER COLUMN "review" DROP NOT NULL;
