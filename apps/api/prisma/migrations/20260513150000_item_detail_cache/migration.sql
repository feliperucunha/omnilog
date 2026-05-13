-- CreateTable
CREATE TABLE "ItemDetailCache" (
    "mediaType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "networks" TEXT,
    "status" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemDetailCache_pkey" PRIMARY KEY ("mediaType", "externalId")
);
