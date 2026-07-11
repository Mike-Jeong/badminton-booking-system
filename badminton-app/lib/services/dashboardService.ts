/**
 * DashboardService (architecture.md 2장, requirements.md 16번)
 * - getTodaySummary(): Pacific/Auckland 기준 "오늘"의 세션별/합계 현황
 * - getSummaryByDateRange(from, to): 날짜 범위의 세션별 현황
 * - 경고 지표는 "대기 인원(WAITING) 존재 여부"다(decisions.md D-16) — "슬롯 초과"는
 *   D-14(관리자 액션 시 슬롯 자동 확장)/D-15(슬롯 감소 시 확정 인원 미만 저장 차단) 이후
 *   앱의 정상 동작으로는 발생하지 않아 이 지표로 대체됐다.
 */

import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors";
import { dateOnlyToUtcMidnight, formatDateOnlyInTimeZone, getTodayDateOnlyInTimeZone } from "@/lib/timezone";
import type { SlotMode } from "@prisma/client";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface BookingDaySummary {
  id: string;
  date: string;
  dayOfWeek: number;
  label: string | null;
  location: string;
  slotMode: SlotMode;
  totalSlots: number;
  confirmedCount: number;
  waitingCount: number;
  cancelledCount: number;
  usageRate: number; // confirmedCount / totalSlots, totalSlots=0이면 0
  hasWaiting: boolean;
}

export interface TodaySummary {
  date: string;
  totalConfirmed: number;
  totalWaiting: number;
  totalCancelled: number;
  sessions: BookingDaySummary[];
}

interface BookingDayRow {
  id: string;
  date: Date;
  dayOfWeek: number;
  label: string | null;
  location: string;
  slotMode: SlotMode;
  totalSlots: number;
}

async function summarize(bookingDays: BookingDayRow[]): Promise<BookingDaySummary[]> {
  if (bookingDays.length === 0) return [];

  const counts = await prisma.booking.groupBy({
    by: ["bookingDayId", "status"],
    where: { bookingDayId: { in: bookingDays.map((bd) => bd.id) } },
    _count: { _all: true },
  });

  const countMap = new Map<string, { CONFIRMED: number; WAITING: number; CANCELLED: number }>();
  for (const row of counts) {
    const entry = countMap.get(row.bookingDayId) ?? { CONFIRMED: 0, WAITING: 0, CANCELLED: 0 };
    entry[row.status] = row._count._all;
    countMap.set(row.bookingDayId, entry);
  }

  return bookingDays.map((bd) => {
    const c = countMap.get(bd.id) ?? { CONFIRMED: 0, WAITING: 0, CANCELLED: 0 };
    return {
      id: bd.id,
      date: formatDateOnlyInTimeZone(bd.date),
      dayOfWeek: bd.dayOfWeek,
      label: bd.label,
      location: bd.location,
      slotMode: bd.slotMode,
      totalSlots: bd.totalSlots,
      confirmedCount: c.CONFIRMED,
      waitingCount: c.WAITING,
      cancelledCount: c.CANCELLED,
      usageRate: bd.totalSlots > 0 ? c.CONFIRMED / bd.totalSlots : 0,
      hasWaiting: c.WAITING > 0,
    };
  });
}

/** Pacific/Auckland 기준 "오늘" 날짜에 해당하는 예약일(세션)들의 현황과 합계를 반환한다. */
export async function getTodaySummary(): Promise<TodaySummary> {
  const today = getTodayDateOnlyInTimeZone();
  const todayUtc = dateOnlyToUtcMidnight(today);

  const bookingDays = await prisma.bookingDay.findMany({
    where: { date: todayUtc },
    orderBy: [{ createdAt: "asc" }],
  });

  const sessions = await summarize(bookingDays);

  return {
    date: today,
    totalConfirmed: sessions.reduce((sum, s) => sum + s.confirmedCount, 0),
    totalWaiting: sessions.reduce((sum, s) => sum + s.waitingCount, 0),
    totalCancelled: sessions.reduce((sum, s) => sum + s.cancelledCount, 0),
    sessions,
  };
}

/** from~to(포함, Pacific/Auckland 기준 "YYYY-MM-DD") 범위의 예약일별 현황을 날짜순으로 반환한다. */
export async function getSummaryByDateRange(from: string, to: string): Promise<BookingDaySummary[]> {
  if (!DATE_ONLY_PATTERN.test(from) || !DATE_ONLY_PATTERN.test(to)) {
    throw new ValidationError("from, to는 YYYY-MM-DD 형식이어야 합니다.");
  }
  const fromUtc = dateOnlyToUtcMidnight(from);
  const toUtc = dateOnlyToUtcMidnight(to);
  if (fromUtc > toUtc) {
    throw new ValidationError("from은 to보다 이후일 수 없습니다.");
  }

  const bookingDays = await prisma.bookingDay.findMany({
    where: { date: { gte: fromUtc, lte: toUtc } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  return summarize(bookingDays);
}
