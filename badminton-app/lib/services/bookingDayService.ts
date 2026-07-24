/**
 * BookingDayService (architecture.md 2장, requirements.md 3·6·11·13번)
 * - createBookingDay / updateBookingDay / deleteBookingDay / listBookingDays / getBookingDayById
 * - dayOfWeek는 서버가 date로부터 자동 계산한다(사용자 입력 아님, 확정사항).
 * - slotMode=SEPARATED면 totalSlots = annualSlots + casualSlots 검증(불일치 시 ValidationError).
 * - date는 unique 아님(같은 날짜 여러 세션 허용, label 필드로 구분).
 * - 슬롯 증가 시 promoteWaitingBookings를 호출해 대기자를 자동 승격한다(11번).
 * - 슬롯 감소 시 새 슬롯 수가 현재 확정(CONFIRMED) 인원보다 작으면 저장 자체를 거부한다
 *   (13번, decisions.md D-15 — 경고 후 허용하던 이전 정책을 대체).
 * - 예약일 생성 직후 applyMonthlyMembersToBookingDay를 호출해 연/월/요일이 일치하는
 *   활성 월 멤버를 자동 배정한다(6번, roadmap.md Phase 4).
 */

import type { Prisma, SlotMode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import {
  dateOnlyToUtcMidnight,
  getDayOfWeekForDateOnly,
} from "@/lib/timezone";
import { promoteWaitingBookings } from "@/lib/services/bookingService";
import { applyMonthlyMembersToBookingDay } from "@/lib/services/monthlyMemberService";
import type { PrismaClientOrTx } from "@/lib/services/annualMemberService";
import { assertTimeRange, isValidSlotMode, validateSlots } from "@/lib/validation/bookingSlots";

export interface BookingDayInput {
  date: string; // "YYYY-MM-DD", Pacific/Auckland 기준 캘린더 날짜
  label?: string | null;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm", startTime보다 늦어야 함
  location: string;
  dutyPerson: string;
  totalSlots: number;
  annualSlots?: number;
  casualSlots?: number;
  slotMode: SlotMode;
  isOpen?: boolean;
}

export interface BookingDayUpdateInput {
  date?: string;
  label?: string | null;
  startTime?: string;
  endTime?: string;
  location?: string;
  dutyPerson?: string;
  totalSlots?: number;
  annualSlots?: number;
  casualSlots?: number;
  slotMode?: SlotMode;
  isOpen?: boolean;
}

export interface ListBookingDaysFilter {
  isOpen?: boolean;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: unknown): value is string {
  return typeof value === "string" && DATE_ONLY_PATTERN.test(value);
}

/**
 * 새 슬롯 수가 현재 확정(CONFIRMED) 인원보다 작으면 저장을 거부한다(requirements.md 13번,
 * decisions.md D-15). 분리 슬롯 모드는 연/캐주얼 풀별로, 통합 슬롯 모드는 전체로 검증한다.
 */
async function assertSlotsNotBelowConfirmed(
  client: PrismaClientOrTx,
  bookingDayId: string,
  next: { slotMode: SlotMode; totalSlots: number; annualSlots: number; casualSlots: number }
) {
  if (next.slotMode === "SEPARATED") {
    const [annualConfirmed, casualConfirmed] = await Promise.all([
      client.booking.count({
        where: { bookingDayId, status: "CONFIRMED", memberType: "ANNUAL" },
      }),
      client.booking.count({
        where: { bookingDayId, status: "CONFIRMED", memberType: "CASUAL" },
      }),
    ]);
    if (next.annualSlots < annualConfirmed) {
      throw new ValidationError(
        `연 멤버 슬롯 수(${next.annualSlots}명)를 현재 확정 인원(${annualConfirmed}명)보다 적게 설정할 수 없습니다.`
      );
    }
    if (next.casualSlots < casualConfirmed) {
      throw new ValidationError(
        `캐주얼 슬롯 수(${next.casualSlots}명)를 현재 확정 인원(${casualConfirmed}명)보다 적게 설정할 수 없습니다.`
      );
    }
    return;
  }

  const totalConfirmed = await client.booking.count({
    where: { bookingDayId, status: "CONFIRMED" },
  });
  if (next.totalSlots < totalConfirmed) {
    throw new ValidationError(
      `전체 슬롯 수(${next.totalSlots}명)를 현재 확정 인원(${totalConfirmed}명)보다 적게 설정할 수 없습니다.`
    );
  }
}

export interface CreateBookingDayOptions {
  /**
   * 예약일 생성 직후 월 멤버 자동 배정을 실행할지 여부(decisions.md D-19).
   * 기본값 true. 같은 요일에 세션이 여러 개 열리는 경우, 관리자가 화면에서 확인 대화상자를
   * 통해 false를 선택하면 이 예약일에는 월 멤버가 자동으로 추가되지 않는다(필요하면 예약일
   * 상세 화면의 수동 "월 멤버 자동 배정" 버튼으로 나중에 실행 가능).
   */
  autoAssignMonthlyMembers?: boolean;
}

export async function createBookingDay(input: BookingDayInput, options: CreateBookingDayOptions = {}) {
  if (!isValidDateOnly(input.date)) {
    throw new ValidationError("date는 YYYY-MM-DD 형식이어야 합니다.");
  }
  if (!isValidSlotMode(input.slotMode)) {
    throw new ValidationError("slotMode는 SEPARATED 또는 COMBINED여야 합니다.");
  }
  if (!input.location || !input.location.trim()) {
    throw new ValidationError("장소(location)는 필수입니다.");
  }
  if (!input.dutyPerson || !input.dutyPerson.trim()) {
    throw new ValidationError("듀티 담당자(dutyPerson)는 필수입니다.");
  }
  assertTimeRange(input.startTime, input.endTime);

  const slotMode = input.slotMode;
  const annualSlots = slotMode === "SEPARATED" ? Number(input.annualSlots ?? 0) : 0;
  const casualSlots = slotMode === "SEPARATED" ? Number(input.casualSlots ?? 0) : 0;
  const totalSlots = Number(input.totalSlots);

  validateSlots({ slotMode, totalSlots, annualSlots, casualSlots });

  const dayOfWeek = getDayOfWeekForDateOnly(input.date);
  const dateValue = dateOnlyToUtcMidnight(input.date);

  const bookingDay = await prisma.bookingDay.create({
    data: {
      date: dateValue,
      dayOfWeek,
      label: input.label?.trim() ? input.label.trim() : null,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location.trim(),
      dutyPerson: input.dutyPerson.trim(),
      totalSlots,
      annualSlots,
      casualSlots,
      slotMode,
      isOpen: input.isOpen ?? true,
    },
  });

  const autoAssign = options.autoAssignMonthlyMembers ?? true;
  const monthlyMemberAssignment = autoAssign
    ? await applyMonthlyMembersToBookingDay(bookingDay.id)
    : null;

  return { ...bookingDay, monthlyMemberAssignment };
}

export async function updateBookingDay(id: string, input: BookingDayUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.bookingDay.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("예약일을 찾을 수 없습니다.");
    }

    if (input.slotMode !== undefined && !isValidSlotMode(input.slotMode)) {
      throw new ValidationError("slotMode는 SEPARATED 또는 COMBINED여야 합니다.");
    }

    const slotMode = input.slotMode ?? existing.slotMode;
    const totalSlots = input.totalSlots !== undefined ? Number(input.totalSlots) : existing.totalSlots;
    const annualSlots =
      slotMode === "SEPARATED"
        ? Number(input.annualSlots ?? existing.annualSlots)
        : 0;
    const casualSlots =
      slotMode === "SEPARATED"
        ? Number(input.casualSlots ?? existing.casualSlots)
        : 0;

    validateSlots({ slotMode, totalSlots, annualSlots, casualSlots });
    await assertSlotsNotBelowConfirmed(tx, id, { slotMode, totalSlots, annualSlots, casualSlots });

    const startTime = input.startTime ?? existing.startTime;
    const endTime = input.endTime ?? existing.endTime;
    assertTimeRange(startTime, endTime);

    const data: Prisma.BookingDayUpdateInput = {
      startTime,
      endTime,
      location: input.location !== undefined ? input.location.trim() : undefined,
      dutyPerson: input.dutyPerson !== undefined ? input.dutyPerson.trim() : undefined,
      totalSlots,
      annualSlots,
      casualSlots,
      slotMode,
      isOpen: input.isOpen,
    };

    if (input.label !== undefined) {
      data.label = input.label?.trim() ? input.label.trim() : null;
    }

    if (input.date !== undefined) {
      if (!isValidDateOnly(input.date)) {
        throw new ValidationError("date는 YYYY-MM-DD 형식이어야 합니다.");
      }
      data.date = dateOnlyToUtcMidnight(input.date);
      data.dayOfWeek = getDayOfWeekForDateOnly(input.date);
    }

    const updated = await tx.bookingDay.update({ where: { id }, data });

    // 슬롯이 늘지 않았어도 다시 계산하는 건 항상 안전하다(승격 가능한 여유가 없으면 그냥 no-op).
    // 모드 전환(SEPARATED<->COMBINED) 등 "증가 여부" 판단이 애매한 경우까지 한 번에 커버한다.
    await promoteWaitingBookings(id, tx);

    return updated;
  });
}

/**
 * 예약일 삭제(decisions.md D-17). 확정/대기(CONFIRMED/WAITING) 중인 예약이 하나라도 있으면
 * 막고, 관리자가 먼저 취소 처리하도록 안내한다. CANCELLED 이력만 있는 경우(또는 예약이
 * 전혀 없는 경우)는 삭제를 허용하며, 그 CANCELLED 기록도 예약일과 함께 정리한다 —
 * 예약이 하나도 활성 상태가 아닌 예약일을 영구히 지울 수 없게 되는 것을 막기 위함이다.
 */
export async function deleteBookingDay(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.bookingDay.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("예약일을 찾을 수 없습니다.");
    }

    const activeCount = await tx.booking.count({
      where: { bookingDayId: id, status: { in: ["CONFIRMED", "WAITING"] } },
    });
    if (activeCount > 0) {
      throw new ConflictError(
        `이 예약일에는 확정/대기 중인 예약이 ${activeCount}건 있어 삭제할 수 없습니다. 예약을 먼저 취소 처리한 뒤 다시 시도해주세요.`
      );
    }

    const { count: deletedBookingCount } = await tx.booking.deleteMany({
      where: { bookingDayId: id },
    });
    await tx.bookingDay.delete({ where: { id } });

    return { id, deletedBookingCount };
  });
}

export async function listBookingDays(filter: ListBookingDaysFilter = {}) {
  return prisma.bookingDay.findMany({
    where: {
      isOpen: filter.isOpen,
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

export async function getBookingDayById(id: string) {
  const bookingDay = await prisma.bookingDay.findUnique({
    where: { id },
    include: {
      bookings: {
        where: { status: { in: ["CONFIRMED", "WAITING"] } },
        select: {
          id: true,
          name: true,
          status: true,
          memberType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!bookingDay) {
    throw new NotFoundError("예약일을 찾을 수 없습니다.");
  }

  return bookingDay;
}
