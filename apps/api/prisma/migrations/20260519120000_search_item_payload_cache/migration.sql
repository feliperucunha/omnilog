CREATE TABLE "SearchResponseCache" (
    "mediaType" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchResponseCache_pkey" PRIMARY KEY ("mediaType","queryKey")
);

CREATE TABLE "ItemPayloadCache" (
    "mediaType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemPayloadCache_pkey" PRIMARY KEY ("mediaType","externalId")
);
