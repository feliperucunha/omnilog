-- AlterTable
ALTER TABLE "User" ADD COLUMN "city" TEXT,
ADD COLUMN "cityLabel" TEXT,
ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "priceMinor" INTEGER NOT NULL,
    "priceCurrency" TEXT NOT NULL DEFAULT 'BRL',
    "description" TEXT NOT NULL,
    "acceptTrade" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" BOOLEAN NOT NULL DEFAULT true,
    "contactWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT NOT NULL,
    "cityLabel" TEXT NOT NULL,
    "country" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketListing_logId_key" ON "MarketListing"("logId");

-- CreateIndex
CREATE INDEX "MarketListing_active_mediaType_city_idx" ON "MarketListing"("active", "mediaType", "city");

-- CreateIndex
CREATE INDEX "MarketListing_userId_idx" ON "MarketListing"("userId");

-- CreateIndex
CREATE INDEX "MarketListing_createdAt_idx" ON "MarketListing"("createdAt");

-- CreateIndex
CREATE INDEX "MarketListing_active_createdAt_idx" ON "MarketListing"("active", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_logId_fkey" FOREIGN KEY ("logId") REFERENCES "Log"("id") ON DELETE CASCADE ON UPDATE CASCADE;
