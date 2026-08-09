-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentProof_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
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
    "paymentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "paymentConfirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cancelledAt" DATETIME,
    CONSTRAINT "Booking_bookingDayId_fkey" FOREIGN KEY ("bookingDayId") REFERENCES "BookingDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_matchedAnnualMemberId_fkey" FOREIGN KEY ("matchedAnnualMemberId") REFERENCES "AnnualMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("bookingDayId", "cancelledAt", "createdAt", "id", "matchedAnnualMemberId", "memberType", "name", "normalizedName", "phoneEncrypted", "phoneHash", "source", "status", "updatedAt") SELECT "bookingDayId", "cancelledAt", "createdAt", "id", "matchedAnnualMemberId", "memberType", "name", "normalizedName", "phoneEncrypted", "phoneHash", "source", "status", "updatedAt" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_bookingDayId_normalizedName_phoneHash_idx" ON "Booking"("bookingDayId", "normalizedName", "phoneHash");
CREATE INDEX "Booking_phoneHash_idx" ON "Booking"("phoneHash");
CREATE INDEX "Booking_bookingDayId_status_idx" ON "Booking"("bookingDayId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProof_bookingId_key" ON "PaymentProof"("bookingId");
