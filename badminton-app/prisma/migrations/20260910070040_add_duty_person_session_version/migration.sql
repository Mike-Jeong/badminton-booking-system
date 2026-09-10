-- 듀티 세션 무효화용 sessionVersion 컬럼 추가(decisions.md D-38 개정 2026-09-10).
-- prisma migrate dev가 생성한 원본은 DutyPerson 테이블을 재생성(RedefineTables: CREATE new_ →
-- INSERT SELECT → DROP → RENAME)하는 형태였으나, BookingDay.dutyPersonId /
-- ClubDayPattern.dutyPersonId가 이 테이블을 FK로 참조하고 있어 DROP/RENAME이 참조 무결성을
-- 흔들 위험이 있다(20260909060437_add_duty_person과 동일한 이유).
-- 기본값이 있는 컬럼 하나를 덧붙이는 것뿐이므로 순수 additive ALTER TABLE로 다시 작성했다.

-- AlterTable
ALTER TABLE "DutyPerson" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;
