-- CreateTable
CREATE TABLE "User" (
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
CREATE TABLE "Log" (
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Log_userId_idx" ON "Log"("userId");

-- CreateIndex
CREATE INDEX "Log_userId_mediaType_idx" ON "Log"("userId", "mediaType");

-- CreateIndex
CREATE INDEX "Log_mediaType_externalId_idx" ON "Log"("mediaType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Log_userId_mediaType_externalId_key" ON "Log"("userId", "mediaType", "externalId");

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
