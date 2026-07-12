/**
 * MonthlyMemberService (architecture.md 2장, requirements.md 5·6·19번)
 * - createMonthlyMember / updateMonthlyMember / deactivateMonthlyMember / listMonthlyMembers
 * - applyMonthlyMembersToBookingDay
 * - 하드 삭제 없음(decisions.md D-07). "삭제" 액션은 deactivateMonthlyMember(isActive=false)로 처리.
 */

import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import { hasCapacity } from "@/lib/services/bookingService";
import { formatDateOnlyInTimeZone } from "@/lib/timezone";
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

/**
 * 월 멤버 등록(requirements.md 5번). 같은 연 멤버가 같은 월에 여러 요일로 등록될 수 있으나,
 * (annualMemberId, year, month, dayOfWeek) 조합 중복은 막는다.
 */
export async function createMonthlyMember(input: MonthlyMemberInput) {
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

  return prisma.monthlyMember.create({
    data: {
      annualMemberId: input.annualMemberId,
      year: input.year,
      month: input.month,
      dayOfWeek: input.dayOfWeek,
      memo: input.memo?.trim() || null,
    },
  });
}

/** 월 멤버 수정. 대상(연 멤버/연도/월/요일)은 등록 후 바꿀 수 없고, 활성 여부/메모만 수정한다. */
export async function updateMonthlyMember(id: string, input: MonthlyMemberUpdateInput) {
  const existing = await prisma.monthlyMember.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("월 멤버를 찾을 수 없습니다.");
  }

  return prisma.monthlyMember.update({
    where: { id },
    data: {
      isActive: input.isActive,
      memo: input.memo !== undefined ? input.memo?.trim() || null : undefined,
    },
  });
}

/** 하드 삭제 없음(decisions.md D-07). 비활성화 후에는 자동 배정 대상에서 제외된다. */
export async function deactivateMonthlyMember(id: string) {
  const existing = await prisma.monthlyMember.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("월 멤버를 찾을 수 없습니다.");
  }
  return prisma.monthlyMember.update({ where: { id }, data: { isActive: false } });
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
