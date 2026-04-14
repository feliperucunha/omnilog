-- Custom opponent labels for board-game match autocomplete (per account).
CREATE TABLE "UserBoardGameCustomOpponent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBoardGameCustomOpponent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBoardGameCustomOpponent_userId_labelKey_key" ON "UserBoardGameCustomOpponent"("userId", "labelKey");

CREATE INDEX "UserBoardGameCustomOpponent_userId_lastUsedAt_idx" ON "UserBoardGameCustomOpponent"("userId", "lastUsedAt");

ALTER TABLE "UserBoardGameCustomOpponent" ADD CONSTRAINT "UserBoardGameCustomOpponent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
