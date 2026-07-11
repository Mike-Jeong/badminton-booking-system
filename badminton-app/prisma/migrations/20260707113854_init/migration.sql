-- CreateTable
CREATE TABLE "AnnualMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneEncrypted" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonthlyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "annualMemberId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyMember_annualMemberId_fkey" FOREIGN KEY ("annualMemberId") REFERENCES "AnnualMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "label" TEXT,
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

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingDayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneEncrypted" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "matchedAnnualMemberId" TEXT,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cancelledAt" DATETIME,
    CONSTRAINT "Booking_bookingDayId_fkey" FOREIGN KEY ("bookingDayId") REFERENCES "BookingDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_matchedAnnualMemberId_fkey" FOREIGN KEY ("matchedAnnualMemberId") REFERENCES "AnnualMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnualMember_normalizedName_phoneHash_key" ON "AnnualMember"("normalizedName", "phoneHash");

-- CreateIndex
CREATE INDEX "MonthlyMember_year_month_dayOfWeek_idx" ON "MonthlyMember"("year", "month", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyMember_annualMemberId_year_month_dayOfWeek_key" ON "MonthlyMember"("annualMemberId", "year", "month", "dayOfWeek");

-- CreateIndex
CREATE INDEX "BookingDay_date_idx" ON "BookingDay"("date");

-- CreateIndex
CREATE INDEX "Booking_bookingDayId_normalizedName_phoneHash_idx" ON "Booking"("bookingDayId", "normalizedName", "phoneHash");

-- CreateIndex
CREATE INDEX "Booking_phoneHash_idx" ON "Booking"("phoneHash");

-- CreateIndex
CREATE INDEX "Booking_bookingDayId_status_idx" ON "Booking"("bookingDayId", "status");
