-- AlterTable
ALTER TABLE "BookingDay" ADD COLUMN "clubDayPatternId" TEXT;

-- CreateTable
CREATE TABLE "ClubDayPattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
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
    "autoAssignMonthlyMembers" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ClubDayPattern_dayOfWeek_isActive_idx" ON "ClubDayPattern"("dayOfWeek", "isActive");

-- CreateIndex
CREATE INDEX "BookingDay_clubDayPatternId_idx" ON "BookingDay"("clubDayPatternId");
