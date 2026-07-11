/*
  Warnings:

  - Added the required column `endTime` to the `BookingDay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `BookingDay` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BookingDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "label" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "dutyPerson" TEXT NOT NULL,
    "totalSlots" INTEGER NOT NULL,
    "annualSlots" INTEGER NOT NULL DEFAULT 0,
    "casualSlots" INTEGER NOT NULL DEFAULT 0,
    "slotMode" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BookingDay" ("annualSlots", "casualSlots", "createdAt", "date", "dayOfWeek", "dutyPerson", "id", "isOpen", "label", "location", "slotMode", "totalSlots", "updatedAt") SELECT "annualSlots", "casualSlots", "createdAt", "date", "dayOfWeek", "dutyPerson", "id", "isOpen", "label", "location", "slotMode", "totalSlots", "updatedAt" FROM "BookingDay";
DROP TABLE "BookingDay";
ALTER TABLE "new_BookingDay" RENAME TO "BookingDay";
CREATE INDEX "BookingDay_date_idx" ON "BookingDay"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
