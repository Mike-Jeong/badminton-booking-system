/**
 * ClubDayGenerationService (architecture.md 2장, requirements.md 25.3번, decisions.md D-27~D-30)
 * - generateUpcomingClubDays: 크론(GET /api/cron/club-days)이 호출하는 핵심 함수. 실행 시점
 *   기준 "모레"(+2일) 날짜에 대해 생성한다(decisions.md D-27 개정).
 * - "생성"과 "공개"를 한 스텝으로 처리한다(decisions.md D-27) — 생성되는 BookingDay는 항상
 *   isOpen=true다. "미리 생성해두고 나중에 공개 전환"하는 중간 상태는 두지 않는다.
 * - 패턴마다 개별 트랜잭션을 열어(패턴 간 격리) 중복 생성 확인 + BookingDay 생성 +
 *   (조건부) 월 멤버 자동 배정까지 하나의 트랜잭션으로 묶는다. 한 패턴의 처리 실패가 다른
 *   패턴 처리에 영향을 주지 않는다.
 */

import { prisma } from "@/lib/db/prisma";
import {
  addDaysToDateOnly,
  dateOnlyToUtcMidnight,
  formatDateOnlyInTimeZone,
  getDayOfWeekForDateOnly,
} from "@/lib/timezone";
import { applyMonthlyMembersToBookingDay } from "@/lib/services/monthlyMemberService";

export type ClubDayGenerationStatus = "created" | "skipped" | "failed";

export interface ClubDayGenerationResult {
  patternId: string;
  status: ClubDayGenerationStatus;
  bookingDayId?: string;
  error?: string;
}

/** 크론이 예약일을 생성하는 시점부터 실제 생성 대상일까지의 간격(일). decisions.md D-27 개정. */
const GENERATION_LEAD_DAYS = 2;

/**
 * 실행 시점의 Pacific/Auckland 기준 "모레"(+2일, GENERATION_LEAD_DAYS) 날짜/요일과 일치하는
 * 활성 클럽데이 패턴을 찾아 BookingDay를 생성하고 즉시 공개(isOpen=true)한다(requirements.md
 * 25.3번, decisions.md D-27 개정).
 * - "정확히 정해진 시각에 실행된다"고 가정하지 않는다 — Vercel Cron의 실행 시각 흔들림
 *   (deployment.md 1-1장)을 감안해, 실행되는 순간의 날짜를 다시 계산해 그 날짜+2일 기준으로
 *   생성한다.
 * - 같은 패턴 + 같은 날짜 조합이 이미 생성돼 있으면 건너뛴다(멱등성, decisions.md D-28).
 */
export async function generateUpcomingClubDays(now: Date = new Date()): Promise<ClubDayGenerationResult[]> {
  const todayDateOnly = formatDateOnlyInTimeZone(now);
  const targetDateOnly = addDaysToDateOnly(todayDateOnly, GENERATION_LEAD_DAYS);
  const targetDayOfWeek = getDayOfWeekForDateOnly(targetDateOnly);
  const targetUtcMidnight = dateOnlyToUtcMidnight(targetDateOnly);

  const patterns = await prisma.clubDayPattern.findMany({
    where: { isActive: true, deletedAt: null, dayOfWeek: targetDayOfWeek },
  });

  const results: ClubDayGenerationResult[] = [];

  for (const pattern of patterns) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.bookingDay.findFirst({
          where: { clubDayPatternId: pattern.id, date: targetUtcMidnight },
        });
        if (existing) {
          return { status: "skipped" as const };
        }

        const bookingDay = await tx.bookingDay.create({
          data: {
            date: targetUtcMidnight,
            dayOfWeek: targetDayOfWeek,
            label: pattern.label,
            startTime: pattern.startTime,
            endTime: pattern.endTime,
            location: pattern.location,
            dutyPerson: pattern.dutyPerson,
            totalSlots: pattern.totalSlots,
            annualSlots: pattern.annualSlots,
            casualSlots: pattern.casualSlots,
            slotMode: pattern.slotMode,
            isOpen: true,
            clubDayPatternId: pattern.id,
          },
        });

        if (pattern.autoAssignMonthlyMembers) {
          await applyMonthlyMembersToBookingDay(bookingDay.id, tx);
        }

        return { status: "created" as const, bookingDayId: bookingDay.id };
      });

      results.push({ patternId: pattern.id, ...result });
    } catch (err) {
      console.error(`[club_day_generation_failed] patternId=${pattern.id}`, err);
      results.push({
        patternId: pattern.id,
        status: "failed",
        error: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    }
  }

  return results;
}
