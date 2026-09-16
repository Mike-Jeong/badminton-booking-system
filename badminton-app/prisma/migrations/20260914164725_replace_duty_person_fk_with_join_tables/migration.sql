-- 듀티 담당자 배정을 "예약일/패턴당 1명(단일 FK)"에서 "N명(다대다 조인 테이블)"으로 바꾸는
-- 마이그레이션(requirements.md 28.3번, decisions.md D-39).
--   - BookingDay.dutyPersonId / ClubDayPattern.dutyPersonId (+ 각 인덱스, FK 제약) 제거
--   - BookingDayDutyPerson / ClubDayPatternDutyPerson 조인 테이블 신설
--
-- 이 브랜치는 아직 프로덕션에 배포된 적이 없어(D-39 "마이그레이션 처리") 백필할 데이터가 없다.
-- 두 컬럼은 항상 NULL이거나 로컬 테스트 값뿐이므로 데이터 마이그레이션 없이 스키마만 바꾼다.
--
-- [왜 ALTER TABLE ... DROP COLUMN을 쓰지 않았는가]
-- 이 프로젝트의 앞선 두 듀티 마이그레이션(20260909060437, 20260910070040)은 prisma migrate dev가
-- 기본으로 생성하는 테이블 재생성(RedefineTables)을 피하고 순수 additive ALTER TABLE로 손수 다시
-- 작성했다. 이번에도 같은 방식을 먼저 시도했으나, SQLite는 "테이블 레벨 FOREIGN KEY 제약이 참조하는
-- 컬럼"은 DROP COLUMN으로 지울 수 없다:
--     Error: stepping, error in table BookingDay after drop column:
--            unknown column "dutyPersonId" in foreign key definition
-- dutyPersonId는 CONSTRAINT "BookingDay_dutyPersonId_fkey" FOREIGN KEY(...) 절에 묶여 있고,
-- SQLite에는 제약만 따로 떼어내는 ALTER TABLE ... DROP CONSTRAINT가 없다. 따라서 이 두 컬럼을
-- 제거하는 유일한 방법은 SQLite 공식 문서(https://sqlite.org/lang_altertable.html#otheralter)가
-- 규정한 테이블 재생성 절차뿐이다. 아래 재생성은 그 절차를 그대로 따르되,
--   * 컬럼 목록을 명시해 INSERT ... SELECT 하므로 기존 행(예약일 400건 이상)이 그대로 보존되고,
--   * 재생성 대상은 BookingDay/ClubDayPattern 두 테이블뿐이며(DutyPerson은 건드리지 않는다 —
--     앞선 두 마이그레이션이 피하려던 위험이 바로 "FK로 참조당하는 DutyPerson의 DROP/RENAME"이었다),
--   * Booking.bookingDayId가 BookingDay를 참조하지만, foreign_keys=OFF + defer_foreign_keys=ON
--     구간 안에서 DROP 직후 즉시 같은 이름으로 RENAME하므로 참조는 그대로 복원된다.

-- ---------------------------------------------------------------------------
-- 1) BookingDay: dutyPersonId 컬럼 + FK 제약 + 인덱스 제거 (테이블 재생성)
-- ---------------------------------------------------------------------------
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

DROP INDEX "BookingDay_dutyPersonId_idx";

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
    "clubDayPatternId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BookingDay" ("id", "date", "dayOfWeek", "label", "startTime", "endTime", "location", "dutyPerson", "totalSlots", "annualSlots", "casualSlots", "slotMode", "isOpen", "clubDayPatternId", "createdAt", "updatedAt")
SELECT "id", "date", "dayOfWeek", "label", "startTime", "endTime", "location", "dutyPerson", "totalSlots", "annualSlots", "casualSlots", "slotMode", "isOpen", "clubDayPatternId", "createdAt", "updatedAt" FROM "BookingDay";
DROP TABLE "BookingDay";
ALTER TABLE "new_BookingDay" RENAME TO "BookingDay";
CREATE INDEX "BookingDay_date_idx" ON "BookingDay"("date");
CREATE INDEX "BookingDay_clubDayPatternId_idx" ON "BookingDay"("clubDayPatternId");

-- ---------------------------------------------------------------------------
-- 2) ClubDayPattern: dutyPersonId 컬럼 + FK 제약 + 인덱스 제거 (테이블 재생성)
-- ---------------------------------------------------------------------------
DROP INDEX "ClubDayPattern_dutyPersonId_idx";

CREATE TABLE "new_ClubDayPattern" (
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
INSERT INTO "new_ClubDayPattern" ("id", "name", "dayOfWeek", "label", "startTime", "endTime", "location", "dutyPerson", "totalSlots", "annualSlots", "casualSlots", "slotMode", "autoAssignMonthlyMembers", "isActive", "deletedAt", "createdAt", "updatedAt")
SELECT "id", "name", "dayOfWeek", "label", "startTime", "endTime", "location", "dutyPerson", "totalSlots", "annualSlots", "casualSlots", "slotMode", "autoAssignMonthlyMembers", "isActive", "deletedAt", "createdAt", "updatedAt" FROM "ClubDayPattern";
DROP TABLE "ClubDayPattern";
ALTER TABLE "new_ClubDayPattern" RENAME TO "ClubDayPattern";
CREATE INDEX "ClubDayPattern_dayOfWeek_isActive_idx" ON "ClubDayPattern"("dayOfWeek", "isActive");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- ---------------------------------------------------------------------------
-- 3) 조인 테이블 신설(순수 additive, decisions.md D-39)
--    - BookingDayDutyPerson: BookingDay 쪽만 ON DELETE CASCADE(예약일은 하드 삭제가 있다, D-17)
--    - ClubDayPatternDutyPerson: 양쪽 모두 기본 동작(Restrict). ClubDayPattern은 소프트 삭제만
--      하므로(D-29) cascade를 미리 걸어두지 않는다(D-39, 의도적 비대칭)
--    - DutyPerson 쪽은 두 테이블 모두 기본 동작 — 계정 하드 삭제가 없어(D-37) 참조 대상이
--      사라질 일이 없다
-- ---------------------------------------------------------------------------
CREATE TABLE "BookingDayDutyPerson" (
    "bookingDayId" TEXT NOT NULL,
    "dutyPersonId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("bookingDayId", "dutyPersonId"),
    CONSTRAINT "BookingDayDutyPerson_bookingDayId_fkey" FOREIGN KEY ("bookingDayId") REFERENCES "BookingDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingDayDutyPerson_dutyPersonId_fkey" FOREIGN KEY ("dutyPersonId") REFERENCES "DutyPerson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "BookingDayDutyPerson_dutyPersonId_idx" ON "BookingDayDutyPerson"("dutyPersonId");

CREATE TABLE "ClubDayPatternDutyPerson" (
    "clubDayPatternId" TEXT NOT NULL,
    "dutyPersonId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("clubDayPatternId", "dutyPersonId"),
    CONSTRAINT "ClubDayPatternDutyPerson_clubDayPatternId_fkey" FOREIGN KEY ("clubDayPatternId") REFERENCES "ClubDayPattern" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClubDayPatternDutyPerson_dutyPersonId_fkey" FOREIGN KEY ("dutyPersonId") REFERENCES "DutyPerson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ClubDayPatternDutyPerson_dutyPersonId_idx" ON "ClubDayPatternDutyPerson"("dutyPersonId");
