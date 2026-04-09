-- AlterTable
ALTER TABLE "User" ADD COLUMN "googlePlayPurchaseToken" TEXT;
ALTER TABLE "User" ADD COLUMN "googlePlayProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googlePlayPurchaseToken_key" ON "User"("googlePlayPurchaseToken");
