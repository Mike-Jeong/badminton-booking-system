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

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import { formatDateOnlyInTimeZone, isBookingDayEnded } from "@/lib/timezone";
import { decryptPhone } from "@/lib/security/phoneCrypto";
import type { PrismaClientOrTx } from "@/lib/services/annualMemberService";
import { ensureParticipantCodesBatch } from "@/lib/services/participantCodeService";

/**
 * 트랜잭션 안에서 월 멤버를 순회하며 매번 조회/생성 쿼리를 날리면(N+1), 월 멤버 수가 많을 때
 * Prisma 기본 트랜잭션 타임아웃(5초)을 넘겨 500 에러가 발생할 수 있었다. 이를 보완하기 위해
 * applyMonthlyMembersToBookingDayCore를 배치 조회/일괄 생성으로 바꾼 뒤에도, 방어적으로
 * 타임아웃 여유를 조금 더 준다(근본 해결은 쿼리 수를 O(N)에서 O(1)로 줄이는 것이고, 이 값은
 * 보조 수단이다).
 */
const APPLY_MONTHLY_MEMBERS_TRANSACTION_OPTIONS = { timeout: 15000 };

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
 *
 * 성능: 이전에는 월 멤버마다 "기존 예약 조회 → 슬롯 여유 확인(hasCapacity) → 생성" 3회
 * 쿼리를 순차 실행했다(N명이면 왕복 3N회). 월 멤버 수가 많아지고 원격 DB(Turso/libSQL) 왕복
 * 지연이 누적되면 Prisma 트랜잭션 기본 타임아웃(5초)을 넘겨 500 에러가 났다. 아래에서는
 * 필요한 조회를 미리 배치로 한 번씩만 수행하고(기존 예약 일괄 조회, 확정 인원 수 1회 조회 후
 * 메모리에서 누적), 생성도 createMany로 한 번에 묶어 쿼리 수를 멤버 수와 무관하게 O(1)로
 * 줄인다.
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

  if (monthlyMembers.length === 0) {
    return { createdCount: 0, skippedCount: 0 };
  }

  // 이 예약일에 이미 WAITING/CONFIRMED로 예약된 (정규화 이름, 전화번호 해시) 조합을 한 번에
  // 조회한다. (annualMemberId, year, month, dayOfWeek) 조합은 유니크하므로 이 배치 안에서
  // 두 월 멤버가 같은 키로 충돌할 일은 없다(서로 다른 연 멤버가 동일한 이름+전화번호로
  // 중복 등록된, 정상 운영에서는 나오지 않는 데이터 이상 상황은 예외로 한다).
  const existingBookings = await tx.booking.findMany({
    where: {
      bookingDayId,
      OR: monthlyMembers.map((mm) => ({
        normalizedName: mm.annualMember.normalizedName,
        phoneHash: mm.annualMember.phoneHash,
      })),
    },
    select: { normalizedName: true, phoneHash: true, status: true },
  });
  const activeKeys = new Set(
    existingBookings
      .filter((b) => b.status === "WAITING" || b.status === "CONFIRMED")
      .map((b) => `${b.normalizedName} ${b.phoneHash}`)
  );

  // hasCapacity를 멤버마다 반복 호출하는 대신, 현재 확정 인원 수를 한 번만 조회하고
  // 이후 새로 확정될 인원을 메모리에서 누적한다(항상 memberType=ANNUAL).
  const capacityLimit = bookingDay.slotMode === "SEPARATED" ? bookingDay.annualSlots : bookingDay.totalSlots;
  const confirmedWhere =
    bookingDay.slotMode === "SEPARATED"
      ? { bookingDayId, status: "CONFIRMED" as const, memberType: "ANNUAL" as const }
      : { bookingDayId, status: "CONFIRMED" as const };
  let confirmedCount = await tx.booking.count({ where: confirmedWhere });

  const toCreate: Prisma.BookingCreateManyInput[] = [];
  let skippedCount = 0;

  for (const monthlyMember of monthlyMembers) {
    const annualMember = monthlyMember.annualMember;
    const key = `${annualMember.normalizedName} ${annualMember.phoneHash}`;
    if (activeKeys.has(key)) {
      skippedCount += 1;
      continue;
    }

    const status: "CONFIRMED" | "WAITING" = confirmedCount < capacityLimit ? "CONFIRMED" : "WAITING";
    if (status === "CONFIRMED") {
      confirmedCount += 1;
    }

    toCreate.push({
      bookingDayId,
      name: annualMember.name,
      normalizedName: annualMember.normalizedName,
      phoneHash: annualMember.phoneHash,
      phoneEncrypted: annualMember.phoneEncrypted,
      memberType: "ANNUAL",
      matchedAnnualMemberId: annualMember.id,
      status,
      source: "MONTHLY_MEMBER_AUTO",
    });
  }

  if (toCreate.length > 0) {
    await tx.booking.createMany({ data: toCreate });
  }

  // 참여자 영구 식별 코드 발급/재사용(requirements.md 27.3번, decisions.md D-33). 이 경로도
  // 예외 없이 대상이며(source=MONTHLY_MEMBER_AUTO), 위와 같은 이유로 배치 함수를 써서 쿼리 수를
  // 멤버 수와 무관하게 유지한다. 이미 예약이 있어 스킵된 멤버도 신원 자체는 동일하므로 대상 전원을
  // 넘긴다(이미 코드가 있으면 재사용되어 아무 일도 일어나지 않는다).
  await ensureParticipantCodesBatch(
    monthlyMembers.map((mm) => ({
      name: mm.annualMember.normalizedName,
      phone: decryptPhone(mm.annualMember.phoneEncrypted),
    })),
    tx
  );

  return { createdCount: toCreate.length, skippedCount };
}

/**
 * 단독 호출 시 자체 트랜잭션으로 감싸고, 예약일 생성 흐름 등 상위 트랜잭션에서는
 * 참여할 수 있도록 tx를 받는다(architecture.md 7장). 단독 호출 시 트랜잭션 타임아웃을
 * 기본값(5초)보다 넉넉하게 준다(위 APPLY_MONTHLY_MEMBERS_TRANSACTION_OPTIONS 주석 참고).
 */
export async function applyMonthlyMembersToBookingDay(
  bookingDayId: string,
  tx?: PrismaClientOrTx
): Promise<ApplyResult> {
  if (tx) {
    return applyMonthlyMembersToBookingDayCore(tx, bookingDayId);
  }
  return prisma.$transaction(
    (trx) => applyMonthlyMembersToBookingDayCore(trx, bookingDayId),
    APPLY_MONTHLY_MEMBERS_TRANSACTION_OPTIONS
  );
}
