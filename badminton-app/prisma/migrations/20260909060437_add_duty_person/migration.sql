-- 듀티 담당자 계정(requirements.md 28번, decisions.md D-36~D-38) 추가 마이그레이션.
-- 기존 BookingDay/ClubDayPattern 데이터를 건드리지 않도록 테이블 재생성(RedefineTables) 대신
-- ALTER TABLE ADD COLUMN으로 nullable FK 컬럼만 덧붙이는 순수 additive 형태로 작성했다
-- (SQLite는 기본값이 NULL인 컬럼에 한해 REFERENCES 절이 있는 컬럼 추가를 허용한다).

-- CreateTable
CREATE TABLE "DutyPerson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DutyPerson_name_key" ON "DutyPerson"("name");

-- AlterTable
ALTER TABLE "BookingDay" ADD COLUMN "dutyPersonId" TEXT REFERENCES "DutyPerson" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "BookingDay_dutyPersonId_idx" ON "BookingDay"("dutyPersonId");

-- AlterTable
ALTER TABLE "ClubDayPattern" ADD COLUMN "dutyPersonId" TEXT REFERENCES "DutyPerson" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ClubDayPattern_dutyPersonId_idx" ON "ClubDayPattern"("dutyPersonId");
