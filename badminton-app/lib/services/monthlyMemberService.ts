/**
 * MonthlyMemberService (architecture.md 2장, requirements.md 5·6·19번)
 * - createMonthlyMember / createMonthlyMembersBulk / updateMonthlyMember / deleteMonthlyMember / listMonthlyMembers
 * - applyMonthlyMembersToBookingDay
 * - 활성/비활성 토글은 updateMonthlyMember(isActive)로 처리한다. 완전 삭제(하드 삭제)는
 *   deleteMonthlyMember로 별도 제공한다 — MonthlyMember는 다른 레코드가 FK로 참조하지 않아
 *   AnnualMember/Booking과 달리 하드 삭제가 이력 무결성을 해치지 않는다(decisions.md D-26,
 *   D-07 정책의 적용 범위를 좁힘).
 * - 연도/월/요일 수정 가능(decisions.md D-21), 등록 시 기존 예약일 소급 배정 옵션(decisions.md D-22).
 * - 한 연 멤버를 여러 요일에 한 번에 등록하는 벌크 등록 지원(decisions.md D-25).
 */

import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import { hasCapacity } from "@/lib/services/bookingService";
import { formatDateOnlyInTimeZone, isBookingDayEnded } from "@/lib/timezone";
import { decryptPhone } from "@/lib/security/phoneCrypto";
import type { PrismaClientOrTx } from "@/lib/services/annualMemberService";

export interface MonthlyMemberInput {
  annualMemberId: string;
  year: number;
  month: number; // 1~12
  dayOfWeek: number; // 0(일)~6(토)
  memo?: string | null;
}

export interface MonthlyMemberUpdateInput {
  year?: number;
  month?: number;
  dayOfWeek?: number;
  isActive?: boolean;
  memo?: string | null;
}

export interface ListMonthlyMembersFilter {
  year?: number;
  month?: number;
}

export interface ApplyResult {
  createdCount: number;
  skippedCount: number;
}

function isValidMonth(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 12;
}

function isValidDayOfWeek(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6;
}

export interface CreateMonthlyMemberOptions {
  /**
   * 등록 직후 이 연/월/요일과 일치하는, 이미 생성되어 있는 예약일들에도 자동 배정을 실행할지
   * 여부(decisions.md D-22). 기본값 false — 관리자 화면은 확인 대화상자를 거쳐 명시적으로
   * true를 넘긴다. 같은 요일에 세션이 여러 개 있으면 그 예약일 모두에 배정될 수 있다.
   * 이미 종료된(date+endTime이 지난) 예약일은 대상에서 제외한다(decisions.md D-23) — 끝난
   * 세션에 소급으로 참석 기록을 만드는 것은 의미가 없다.
   */
  applyToExistingBookingDays?: boolean;
}

/**
 * 월 멤버 등록(requirements.md 5번). 같은 연 멤버가 같은 월에 여러 요일로 등록될 수 있으나,
 * (annualMemberId, year, month, dayOfWeek) 조합 중복은 막는다.
 */
export async function createMonthlyMember(input: MonthlyMemberInput, options: CreateMonthlyMemberOptions = {}) {
  if (!Number.isInteger(input.year) || input.year < 2000) {
    throw new ValidationError("year 값이 올바르지 않습니다.");
  }
  if (!isValidMonth(input.month)) {
    throw new ValidationError("month는 1~12 사이여야 합니다.");
  }
  if (!isValidDayOfWeek(input.dayOfWeek)) {
    throw new ValidationError("dayOfWeek는 0(일)~6(토) 사이여야 합니다.");
  }

  const annualMember = await prisma.annualMember.findUnique({ where: { id: input.annualMemberId } });
  if (!annualMember) {
    throw new NotFoundError("연 멤버를 찾을 수 없습니다.");
  }

  const duplicate = await prisma.monthlyMember.findFirst({
    where: {
      annualMemberId: input.annualMemberId,
      year: input.year,
      month: input.month,
      dayOfWeek: input.dayOfWeek,
    },
  });
  if (duplicate) {
    throw new ConflictError("이미 같은 연도/월/요일로 등록된 월 멤버입니다.");
  }

  const created = await prisma.monthlyMember.create({
    data: {
      annualMemberId: input.annualMemberId,
      year: input.year,
      month: input.month,
      dayOfWeek: input.dayOfWeek,
      memo: input.memo?.trim() || null,
    },
  });

  let existingBookingDayAssignment: ApplyResult | null = null;
  if (options.applyToExistingBookingDays) {
    const allBookingDays = await prisma.bookingDay.findMany({
      select: { id: true, date: true, dayOfWeek: true, endTime: true },
    });
    const targets = allBookingDays.filter((bd) => {
      const [bdYear, bdMonth] = formatDateOnlyInTimeZone(bd.date).split("-").map(Number);
      return (
        bdYear === input.year &&
        bdMonth === input.month &&
        bd.dayOfWeek === input.dayOfWeek &&
        !isBookingDayEnded(bd.date, bd.endTime)
      );
    });

    let createdCount = 0;
    let skippedCount = 0;
    for (const bookingDay of targets) {
      const result = await applyMonthlyMembersToBookingDay(bookingDay.id);
      createdCount += result.createdCount;
      skippedCount += result.skippedCount;
    }
    existingBookingDayAssignment = { createdCount, skippedCount };
  }

  return { ...created, existingBookingDayAssignment };
}

export interface CreateMonthlyMembersBulkInput {
  annualMemberId: string;
  year: number;
  month: number;
  dayOfWeeks: number[];
  memo?: string | null;
}

export interface CreateMonthlyMembersBulkResult {
  created: Awaited<ReturnType<typeof createMonthlyMember>>[];
  skipped: { dayOfWeek: number; message: string }[];
  existingBookingDayAssignment: ApplyResult;
}

/**
 * 한 연 멤버를 여러 요일에 한 번에 등록한다(decisions.md D-25 — "월/수/금 배정하려면 세 번
 * 등록해야 하는" 번거로움을 해소). 요일별로 개별 createMonthlyMember를 호출하며, 이미 등록된
 * 요일(중복)은 건너뛰고 나머지 요일은 계속 진행한다(부분 성공 허용).
 */
export async function createMonthlyMembersBulk(
  input: CreateMonthlyMembersBulkInput,
  options: CreateMonthlyMemberOptions = {}
): Promise<CreateMonthlyMembersBulkResult> {
  if (!Array.isArray(input.dayOfWeeks) || input.dayOfWeeks.length === 0) {
    throw new ValidationError("dayOfWeeks는 최소 1개 이상 선택해야 합니다.");
  }

  const created: Awaited<ReturnType<typeof createMonthlyMember>>[] = [];
  const skipped: { dayOfWeek: number; message: string }[] = [];
  const existingBookingDayAssignment: ApplyResult = { createdCount: 0, skippedCount: 0 };

  for (const dayOfWeek of input.dayOfWeeks) {
    try {
      const result = await createMonthlyMember(
        {
          annualMemberId: input.annualMemberId,
          year: input.year,
          month: input.month,
          dayOfWeek,
          memo: input.memo,
        },
        options
      );
      created.push(result);
      if (result.existingBookingDayAssignment) {
        existingBookingDayAssignment.createdCount += result.existingBookingDayAssignment.createdCount;
        existingBookingDayAssignment.skippedCount += result.existingBookingDayAssignment.skippedCount;
      }
    } catch (err) {
      if (err instanceof ConflictError) {
        skipped.push({ dayOfWeek, message: err.message });
      } else {
        throw err;
      }
    }
  }

  return { created, skipped, existingBookingDayAssignment };
}

/**
 * 월 멤버 수정. 연도/월/요일도 변경 가능하다(decisions.md D-21). 대상(연 멤버) 자체는 바꿀 수
 * 없고, 새 연/월/요일 조합이 다른 레코드와 중복되면 거부한다.
 */
export async function updateMonthlyMember(id: string, input: MonthlyMemberUpdateInput) {
  const existing = await prisma.monthlyMember.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("월 멤버를 찾을 수 없습니다.");
  }

  if (input.year !== undefined && (!Number.isInteger(input.year) || input.year < 2000)) {
    throw new ValidationError("year 값이 올바르지 않습니다.");
  }
  if (input.month !== undefined && !isValidMonth(input.month)) {
    throw new ValidationError("month는 1~12 사이여야 합니다.");
  }
  if (input.dayOfWeek !== undefined && !isValidDayOfWeek(input.dayOfWeek)) {
    throw new ValidationError("dayOfWeek는 0(일)~6(토) 사이여야 합니다.");
  }

  const nextYear = input.year ?? existing.year;
  const nextMonth = input.month ?? existing.month;
  const nextDayOfWeek = input.dayOfWeek ?? existing.dayOfWeek;
  const targetChanged =
    nextYear !== existing.year || nextMonth !== existing.month || nextDayOfWeek !== existing.dayOfWeek;

  if (targetChanged) {
    const duplicate = await prisma.monthlyMember.findFirst({
      where: {
        id: { not: id },
        annualMemberId: existing.annualMemberId,
        year: nextYear,
        month: nextMonth,
        dayOfWeek: nextDayOfWeek,
      },
    });
    if (duplicate) {
      throw new ConflictError("이미 같은 연도/월/요일로 등록된 월 멤버입니다.");
    }
  }

  return prisma.monthlyMember.update({
    where: { id },
    data: {
      year: nextYear,
      month: nextMonth,
      dayOfWeek: nextDayOfWeek,
      isActive: input.isActive,
      memo: input.memo !== undefined ? input.memo?.trim() || null : undefined,
    },
  });
}

/**
 * 월 멤버 완전 삭제(하드 삭제, decisions.md D-26). MonthlyMember는 Booking 등 다른 레코드가
 * FK로 참조하지 않으므로, 삭제해도 예약 이력의 무결성에 영향이 없다. 비활성화(isActive=false)와
 * 별개의 액션으로, 잘못 등록했거나 더 이상 필요 없는 등록을 목록에서 완전히 지우고 싶을 때 쓴다.
 */
export async function deleteMonthlyMember(id: string) {
  const existing = await prisma.monthlyMember.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("월 멤버를 찾을 수 없습니다.");
  }
  await prisma.monthlyMember.delete({ where: { id } });
  return { id };
}

/**
 * 관리자용 월 멤버 목록. 연/월 단위로 필터링하며 연결된 연 멤버 이름/전화번호/활성여부를
 * 함께 반환한다. phoneEncrypted는 이 함수 안에서만 복호화해 사용하고 반환값에는 포함하지 않는다.
 */
export async function listMonthlyMembers(filter: ListMonthlyMembersFilter = {}) {
  const monthlyMembers = await prisma.monthlyMember.findMany({
    where: { year: filter.year, month: filter.month },
    include: {
      annualMember: { select: { id: true, name: true, isActive: true, phoneEncrypted: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { dayOfWeek: "asc" }, { createdAt: "asc" }],
  });
  return monthlyMembers.map((mm) => ({
    ...mm,
    annualMember: {
      id: mm.annualMember.id,
      name: mm.annualMember.name,
      isActive: mm.annualMember.isActive,
      phone: decryptPhone(mm.annualMember.phoneEncrypted),
    },
  }));
}

/**
 * 예약일 하나에 대해 연/월/요일이 일치하는 활성 월 멤버를 자동 배정한다(requirements.md 6·19번).
 * - MonthlyMember.isActive AND AnnualMember.isActive 모두 필요
 * - 중복 방지: 같은 예약일에 WAITING/CONFIRMED가 이미 있으면 스킵, CANCELLED만 있으면 재생성(D-08)
 * - 항상 memberType=ANNUAL, 슬롯 여유 있으면 CONFIRMED 없으면 WAITING
 */
async function applyMonthlyMembersToBookingDayCore(
  tx: PrismaClientOrTx,
  bookingDayId: string
): Promise<ApplyResult> {
  const bookingDay = await tx.bookingDay.findUnique({ where: { id: bookingDayId } });
  if (!bookingDay) {
    throw new NotFoundError("예약일을 찾을 수 없습니다.");
  }

  const [year, month] = formatDateOnlyInTimeZone(bookingDay.date).split("-").map(Number);

  const monthlyMembers = await tx.monthlyMember.findMany({
    where: {
      year,
      month,
      dayOfWeek: bookingDay.dayOfWeek,
      isActive: true,
      annualMember: { isActive: true },
    },
    include: { annualMember: true },
  });

  let createdCount = 0;
  let skippedCount = 0;

  for (const monthlyMember of monthlyMembers) {
    const annualMember = monthlyMember.annualMember;

    const existingBookings = await tx.booking.findMany({
      where: {
        bookingDayId,
        normalizedName: annualMember.normalizedName,
        phoneHash: annualMember.phoneHash,
      },
      select: { status: true },
    });
    if (existingBookings.some((b) => b.status === "WAITING" || b.status === "CONFIRMED")) {
      skippedCount += 1;
      continue;
    }

    const status = (await hasCapacity(tx, bookingDay, "ANNUAL")) ? "CONFIRMED" : "WAITING";

    await tx.booking.create({
      data: {
        bookingDayId,
        name: annualMember.name,
        normalizedName: annualMember.normalizedName,
        phoneHash: annualMember.phoneHash,
        phoneEncrypted: annualMember.phoneEncrypted,
        memberType: "ANNUAL",
        matchedAnnualMemberId: annualMember.id,
        status,
        source: "MONTHLY_MEMBER_AUTO",
      },
    });
    createdCount += 1;
  }

  return { createdCount, skippedCount };
}

/**
 * 단독 호출 시 자체 트랜잭션으로 감싸고, 예약일 생성 흐름 등 상위 트랜잭션에서는
 * 참여할 수 있도록 tx를 받는다(architecture.md 7장).
 */
export async function applyMonthlyMembersToBookingDay(
  bookingDayId: string,
  tx?: PrismaClientOrTx
): Promise<ApplyResult> {
  if (tx) {
    return applyMonthlyMembersToBookingDayCore(tx, bookingDayId);
  }
  return prisma.$transaction((trx) => applyMonthlyMembersToBookingDayCore(trx, bookingDayId));
}
