-- Run this entire script in Supabase Dashboard → SQL Editor → New query.
-- Paste, then click "Run". No need for Prisma to connect from your machine.
-- After this, your app can use DATABASE_URL (Transaction pooler, port 6543).

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "tmdbApiKey" TEXT,
    "rawgApiKey" TEXT,
    "bggApiToken" TEXT,
    "comicVineApiKey" TEXT,
    "preferredTheme" TEXT,
    "preferredLocale" TEXT,
    "visibleMediaTypes" TEXT,
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "grade" INTEGER,
    "review" TEXT,
    "listType" TEXT,
    "status" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "contentHours" DOUBLE PRECISION,
    "season" INTEGER,
    "episode" INTEGER,
    "chapter" INTEGER,
    "volume" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (ignore if exists)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "Log_userId_idx" ON "Log"("userId");
CREATE INDEX IF NOT EXISTS "Log_userId_mediaType_idx" ON "Log"("userId", "mediaType");
CREATE INDEX IF NOT EXISTS "Log_mediaType_externalId_idx" ON "Log"("mediaType", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Log_userId_mediaType_externalId_key" ON "Log"("userId", "mediaType", "externalId");

-- AddForeignKey (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Log_userId_fkey'
    ) THEN
        ALTER TABLE "Log" ADD CONSTRAINT "Log_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Prisma migration history (so "prisma migrate deploy" later won't re-run this)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    '205937c3a2ea3900d487ee477a640c88b47f7c64f6fb15dd9d55112df0ef6fc6',
    now(),
    '20250223000000_init_postgres',
    now(),
    1
)
ON CONFLICT ("id") DO NOTHING;
