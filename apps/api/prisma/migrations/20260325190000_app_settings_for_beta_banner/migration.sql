-- Add AppSetting for editable announcement text.

CREATE TABLE "AppSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

