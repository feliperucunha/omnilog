CREATE TABLE "DiscoverTasteSnapshot" (
    "userId" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DiscoverTasteSnapshot_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "DiscoverTasteSnapshot" ADD CONSTRAINT "DiscoverTasteSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
