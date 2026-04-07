-- CreateTable
CREATE TABLE "BoardGameMatch" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "players" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardGameMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardGameMatch_logId_idx" ON "BoardGameMatch"("logId");

-- CreateIndex
CREATE INDEX "BoardGameMatch_logId_playedAt_idx" ON "BoardGameMatch"("logId", "playedAt");

-- AddForeignKey
ALTER TABLE "BoardGameMatch" ADD CONSTRAINT "BoardGameMatch_logId_fkey" FOREIGN KEY ("logId") REFERENCES "Log"("id") ON DELETE CASCADE ON UPDATE CASCADE;
