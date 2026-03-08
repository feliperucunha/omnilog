-- CreateTable
CREATE TABLE "LogReaction" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogReaction_userId_logId_key" ON "LogReaction"("userId", "logId");

-- CreateIndex
CREATE INDEX "LogReaction_logId_idx" ON "LogReaction"("logId");

-- CreateIndex
CREATE INDEX "LogReaction_userId_idx" ON "LogReaction"("userId");

-- AddForeignKey
ALTER TABLE "LogReaction" ADD CONSTRAINT "LogReaction_logId_fkey" FOREIGN KEY ("logId") REFERENCES "Log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogReaction" ADD CONSTRAINT "LogReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
