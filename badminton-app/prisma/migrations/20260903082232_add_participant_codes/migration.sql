-- CreateTable
CREATE TABLE "ParticipantCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneEncrypted" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "excludedFromExport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ParticipantCodeExportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportedCount" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantCode_code_key" ON "ParticipantCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantCode_normalizedName_phoneHash_key" ON "ParticipantCode"("normalizedName", "phoneHash");
