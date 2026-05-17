CREATE TABLE "ScopedReview" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "seasonNum" INTEGER NOT NULL DEFAULT 0,
    "episodeNum" INTEGER NOT NULL DEFAULT 0,
    "grade" INTEGER,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScopedReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScopedReview_logId_idx" ON "ScopedReview"("logId");

CREATE UNIQUE INDEX "ScopedReview_logId_scope_seasonNum_episodeNum_key" ON "ScopedReview"("logId", "scope", "seasonNum", "episodeNum");

ALTER TABLE "ScopedReview" ADD CONSTRAINT "ScopedReview_logId_fkey" FOREIGN KEY ("logId") REFERENCES "Log"("id") ON DELETE CASCADE ON UPDATE CASCADE;
