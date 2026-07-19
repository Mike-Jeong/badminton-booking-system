/**
 * BookingService (architecture.md 2·7장, requirements.md 7~14·18~20번)
 * - createBooking / cancelBooking / lookupBookingsByPhone / promoteWaitingBookings
 * - adminCreateBooking / adminChangeBookingStatus / adminCancelBooking / listBookingsForAdmin
 * - checkInBooking / checkOutBooking / resetCheckInStatus / scanBookingCheckIn (decisions.md D-27,
 *   회원 입장/퇴장 체크인) — CONFIRMED 예약에 한해 checkedInAt/checkedOutAt를 관리한다. 슬롯/대기
 *   승격 로직과는 무관하다(체크인 여부가 슬롯을 비우거나 채우지 않음).
 *
 * 이번 범위(roadmap.md Phase 2+3): 사용자 예약 신청/취소, 자동승인/대기, 대기 자동승격,
 * 관리자 예약 운영 일부. 연/월 멤버 관리 UI, 월 멤버 자동 배정은 Phase 4에서 이어간다.
 */

import type { Booking, BookingDay, BookingSource, BookingStatus, MemberType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import { normalizeName, normalizePhone } from "@/lib/normalize";
import { hashPhone, encryptPhone, decryptPhone } from "@/lib/security/phoneCrypto";
import { isBookingDayEnded } from "@/lib/timezone";
import { determineMemberType, type PrismaClientOrTx } from "@/lib/services/annualMemberService";

export interface CreateBookingInput {
  bookingDayId: string;
  name: string;
  phone: string;
  source: BookingSource;
}

/** 서비스가 외부로 반환하는 예약 정보. phoneHash/phoneEncrypted/normalizedName은 절대 포함하지 않는다. */
function toBookingDTO(booking: Booking) {
  return {
    id: booking.id,
    bookingDayId: booking.bookingDayId,
    name: booking.name,
    memberType: booking.memberType,
    matchedAnnualMemberId: booking.matchedAnnualMemberId,
    status: booking.status,
    source: booking.source,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    cancelledAt: booking.cancelledAt,
    checkedInAt: booking.checkedInAt,
    checkedOutAt: booking.checkedOutAt,
  };
}

/**
 * 해당 슬롯 풀에 현재 자리가 남아 있는지 확인한다(requirements.md 9번).
 * SEPARATED: memberType별 풀(annualSlots/casualSlots) 기준. COMBINED: totalSlots 기준(교차 없음).
 * monthlyMemberService.applyMonthlyMembersToBookingDay에서도 재사용한다(항상 ANNUAL 판정).
 */
export async function hasCapacity(
  client: PrismaClientOrTx,
  bookingDay: BookingDay,
  memberType: MemberType
): Promise<boolean> {
  if (bookingDay.slotMode === "SEPARATED") {
    const capacity = memberType === "ANNUAL" ? bookingDay.annualSlots : bookingDay.casualSlots;
    const confirmedCount = await client.booking.count({
      where: { bookingDayId: bookingDay.id, status: "CONFIRMED", memberType },
    });
    return confirmedCount < capacity;
  }
  const confirmedCount = await client.booking.count({
    where: { bookingDayId: bookingDay.id, status: "CONFIRMED" },
  });
  return confirmedCount < bookingDay.totalSlots;
}

/**
 * 슬롯이 부족할 때 예약일의 슬롯 수를 1 늘린다(관리자 액션 전용, decisions.md D-14).
 * 분리 슬롯 모드에서는 memberType에 해당하는 세부 슬롯과 totalSlots를 함께 늘려
 * totalSlots = annualSlots + casualSlots 불변식을 유지한다.
 */
async function expandBookingDaySlot(
  tx: PrismaClientOrTx,
  bookingDay: BookingDay,
  memberType: MemberType
) {
  if (bookingDay.slotMode === "SEPARATED") {
    const field = memberType === "ANNUAL" ? "annualSlots" : "casualSlots";
    await tx.bookingDay.update({
      where: { id: bookingDay.id },
      data: { [field]: { increment: 1 }, totalSlots: { increment: 1 } },
    });
  } else {
    await tx.bookingDay.update({
      where: { id: bookingDay.id },
      data: { totalSlots: { increment: 1 } },
    });
  }
}

function validateNameAndPhone(name: string, phone: string) {
  const normalizedName = normalizeName(name);
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedName) {
    throw new ValidationError("이름을 입력해주세요.");
  }
  if (!normalizedPhone) {
    throw new ValidationError("전화번호를 입력해주세요.");
  }
  return { normalizedName, normalizedPhone };
}

/**
 * 예약 생성 공통 로직. 중복/재예약 판정과 memberType 판정은 source와 무관하게 동일하다.
 * `autoExpandSlot`이 true면 슬롯이 부족할 때 WAITING 대신 슬롯을 자동으로 늘려 CONFIRMED로
 * 생성한다(관리자 액션 전용, decisions.md D-14). 사용자 셀프 신청(createBooking)은 false로 고정.
 */
async function createBookingCore(
  tx: PrismaClientOrTx,
  input: CreateBookingInput,
  options: { autoExpandSlot: boolean }
) {
  const { normalizedName, normalizedPhone } = validateNameAndPhone(input.name, input.phone);

  const bookingDay = await tx.bookingDay.findUnique({ where: { id: input.bookingDayId } });
  if (!bookingDay || (input.source === "USER" && !bookingDay.isOpen)) {
    throw new NotFoundError("예약일을 찾을 수 없습니다.");
  }
  if (input.source === "USER" && isBookingDayEnded(bookingDay.date, bookingDay.endTime)) {
    throw new ConflictError("이미 종료된 예약일에는 신청할 수 없습니다.");
  }

  const phoneHash = hashPhone(normalizedPhone);

  const existing = await tx.booking.findMany({
    where: { bookingDayId: input.bookingDayId, normalizedName, phoneHash },
    select: { status: true },
  });
  if (existing.some((b) => b.status === "WAITING" || b.status === "CONFIRMED")) {
    throw new ConflictError("이미 이 예약일에 신청된 예약이 있습니다.");
  }

  const { memberType, matchedAnnualMemberId } = await determineMemberType(
    input.name,
    input.phone,
    tx
  );

  let status: BookingStatus;
  if (await hasCapacity(tx, bookingDay, memberType)) {
    status = "CONFIRMED";
  } else if (options.autoExpandSlot) {
    await expandBookingDaySlot(tx, bookingDay, memberType);
    status = "CONFIRMED";
  } else {
    status = "WAITING";
  }

  return tx.booking.create({
    data: {
      bookingDayId: input.bookingDayId,
      name: normalizedName,
      normalizedName,
      phoneHash,
      phoneEncrypted: encryptPhone(normalizedPhone),
      memberType,
      matchedAnnualMemberId,
      status,
      source: input.source,
    },
  });
}

/**
 * 사용자 예약 신청 (requirements.md 7·18·19번)
 * - 중복/재예약 판정: WAITING/CONFIRMED 있으면 거부, CANCELLED만 있으면 소스 무관 재생성 허용(D-08)
 * - memberType은 서버가 determineMemberType으로 직접 판정(클라이언트 입력 없음)
 * - 슬롯 여유 있으면 CONFIRMED, 없으면 WAITING (자동 슬롯 확장 없음 — 관리자 액션 전용, D-14)
 */
export async function createBooking(input: CreateBookingInput) {
  const created = await prisma.$transaction((tx) =>
    createBookingCore(tx, input, { autoExpandSlot: false })
  );
  return toBookingDTO(created);
}

/** 전화번호로 본인 예약 목록을 조회한다(requirements.md 14.1번). phoneHash로만 비교하며 복호화하지 않는다. */
export async function lookupBookingsByPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new ValidationError("전화번호를 입력해주세요.");
  }
  const phoneHash = hashPhone(normalizedPhone);

  return prisma.booking.findMany({
    where: { phoneHash },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      cancelledAt: true,
      bookingDay: {
        select: { id: true, date: true, label: true, location: true, endTime: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function cancelBookingCore(
  bookingId: string,
  tx: PrismaClientOrTx,
  expectedPhoneHash?: string
) {
  const booking = await tx.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError("예약을 찾을 수 없습니다.");
  }
  if (expectedPhoneHash !== undefined && booking.phoneHash !== expectedPhoneHash) {
    throw new ConflictError("전화번호가 일치하지 않아 취소할 수 없습니다.");
  }
  if (booking.status === "CANCELLED") {
    throw new ConflictError("이미 취소된 예약입니다.");
  }

  // expectedPhoneHash가 있으면 사용자 셀프 취소 경로다(관리자 취소는 종료 여부와 무관하게 허용).
  if (expectedPhoneHash !== undefined) {
    const bookingDay = await tx.bookingDay.findUnique({
      where: { id: booking.bookingDayId },
      select: { date: true, endTime: true },
    });
    if (bookingDay && isBookingDayEnded(bookingDay.date, bookingDay.endTime)) {
      throw new ConflictError("이미 종료된 예약일의 예약은 취소할 수 없습니다.");
    }
  }

  const wasConfirmed = booking.status === "CONFIRMED";
  const updated = await tx.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  if (wasConfirmed) {
    await promoteWaitingBookingsInternal(booking.bookingDayId, tx);
  }

  return updated;
}

/**
 * 사용자 예약 취소 (requirements.md 14.2번)
 * bookingId + 전화번호를 받아 phoneHash 일치 여부를 확인한 뒤에만 취소한다.
 */
export async function cancelBooking(bookingId: string, phone: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    throw new ValidationError("전화번호를 입력해주세요.");
  }
  const phoneHash = hashPhone(normalizedPhone);

  const updated = await prisma.$transaction((tx) => cancelBookingCore(bookingId, tx, phoneHash));
  return toBookingDTO(updated);
}

/** 관리자 취소 처리. 전화번호 검증 없이 취소하며, 승격 로직은 사용자 취소와 동일하다. */
export async function adminCancelBooking(bookingId: string) {
  const updated = await prisma.$transaction((tx) => cancelBookingCore(bookingId, tx));
  return toBookingDTO(updated);
}

/**
 * 관리자 수동 예약 추가(source=ADMIN). 중복/재예약/memberType 판정은 사용자 예약과 동일하다.
 * 슬롯이 부족하면 WAITING이 아니라 슬롯을 자동으로 늘려 항상 CONFIRMED로 생성한다(D-14).
 */
export async function adminCreateBooking(bookingDayId: string, name: string, phone: string) {
  const created = await prisma.$transaction((tx) =>
    createBookingCore(tx, { bookingDayId, name, phone, source: "ADMIN" }, { autoExpandSlot: true })
  );
  return toBookingDTO(created);
}

/**
 * 관리자의 개별 대기 승인 (requirements.md 10번, decisions.md D-14)
 * WAITING -> CONFIRMED만 지원한다. 슬롯 여유와 무관하게 항상 성공하며, 부족하면
 * 슬롯을 자동으로 늘린 뒤 확정한다(FIFO 순서 강제 없음).
 */
export async function adminChangeBookingStatus(bookingId: string, status: BookingStatus) {
  if (status !== "CONFIRMED") {
    throw new ValidationError("대기(WAITING) 예약을 확정(CONFIRMED)으로 승인하는 것만 지원합니다.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundError("예약을 찾을 수 없습니다.");
    }
    if (booking.status !== "WAITING") {
      throw new ConflictError("대기 상태의 예약만 확정으로 변경할 수 있습니다.");
    }

    const bookingDay = await tx.bookingDay.findUnique({ where: { id: booking.bookingDayId } });
    if (!bookingDay) {
      throw new NotFoundError("예약일을 찾을 수 없습니다.");
    }
    if (!(await hasCapacity(tx, bookingDay, booking.memberType))) {
      await expandBookingDaySlot(tx, bookingDay, booking.memberType);
    }

    return tx.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED" } });
  });

  return toBookingDTO(updated);
}

/**
 * 관리자 수동 입장 처리(decisions.md D-27). CONFIRMED 예약에만 적용되며, 이미 입장 처리된
 * 예약에 다시 호출하면 거부한다(실수 방지 — 다시 처리하려면 resetCheckInStatus로 초기화 후).
 */
export async function checkInBooking(bookingId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundError("예약을 찾을 수 없습니다.");
    }
    if (booking.status !== "CONFIRMED") {
      throw new ConflictError("확정(CONFIRMED)된 예약만 입장 처리할 수 있습니다.");
    }
    if (booking.checkedInAt) {
      throw new ConflictError("이미 입장 처리된 예약입니다.");
    }
    return tx.booking.update({ where: { id: bookingId }, data: { checkedInAt: new Date() } });
  });
  return toBookingDTO(updated);
}

/**
 * 관리자 수동 퇴장 처리(decisions.md D-27). 입장 처리(checkedInAt)가 먼저 되어 있어야 하며,
 * 이미 퇴장 처리된 예약에 다시 호출하면 거부한다.
 */
export async function checkOutBooking(bookingId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundError("예약을 찾을 수 없습니다.");
    }
    if (!booking.checkedInAt) {
      throw new ConflictError("입장 처리되지 않은 예약은 퇴장 처리할 수 없습니다.");
    }
    if (booking.checkedOutAt) {
      throw new ConflictError("이미 퇴장 처리된 예약입니다.");
    }
    return tx.booking.update({ where: { id: bookingId }, data: { checkedOutAt: new Date() } });
  });
  return toBookingDTO(updated);
}

/**
 * 입장/퇴장 처리를 취소하고 초기 상태(둘 다 null)로 되돌린다(decisions.md D-27).
 * 스캔 실수나 관리자 오처리를 정정하는 용도.
 */
export async function resetCheckInStatus(bookingId: string) {
  const existing = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!existing) {
    throw new NotFoundError("예약을 찾을 수 없습니다.");
  }
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { checkedInAt: null, checkedOutAt: null },
  });
  return toBookingDTO(updated);
}

/**
 * QR 스캔으로 호출되는 입장/퇴장 처리(decisions.md D-27). 수동 처리와 달리 현재 상태를 보고
 * 자동으로 다음 단계를 판단한다: 미입장 → 입장, 입장만 됨 → 퇴장, 둘 다 됨 → 에러.
 * bookingDayId를 함께 받아 스캔 화면이 열려 있는 예약일과 실제 예약의 예약일이 일치하는지
 * 검증한다(다른 날짜의 QR을 잘못 스캔하는 실수 방지).
 */
export async function scanBookingCheckIn(bookingId: string, bookingDayId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundError("예약을 찾을 수 없습니다.");
    }
    if (booking.bookingDayId !== bookingDayId) {
      throw new ConflictError("이 QR 코드는 다른 예약일의 예약입니다.");
    }
    if (booking.status !== "CONFIRMED") {
      throw new ConflictError("확정(CONFIRMED)된 예약만 체크인할 수 있습니다.");
    }

    if (!booking.checkedInAt) {
      const result = await tx.booking.update({
        where: { id: bookingId },
        data: { checkedInAt: new Date() },
      });
      return { booking: result, action: "CHECKED_IN" as const };
    }
    if (!booking.checkedOutAt) {
      const result = await tx.booking.update({
        where: { id: bookingId },
        data: { checkedOutAt: new Date() },
      });
      return { booking: result, action: "CHECKED_OUT" as const };
    }
    throw new ConflictError(
      "이미 입장/퇴장이 모두 처리되었습니다. 다시 처리하려면 관리자 화면에서 직접 수정해주세요."
    );
  });

  return { booking: toBookingDTO(updated.booking), action: updated.action };
}

/**
 * 관리자용 예약자 전체 목록(이름/전화번호/상태/유형/source, architecture.md 4장).
 * 전화번호는 이 함수에서만 복호화한다.
 */
export async function listBookingsForAdmin(bookingDayId: string) {
  const bookings = await prisma.booking.findMany({
    where: { bookingDayId },
    orderBy: [{ createdAt: "asc" }],
  });

  return bookings.map((b) => ({
    id: b.id,
    name: b.name,
    phone: decryptPhone(b.phoneEncrypted),
    memberType: b.memberType,
    status: b.status,
    source: b.source,
    createdAt: b.createdAt,
    cancelledAt: b.cancelledAt,
    checkedInAt: b.checkedInAt,
    checkedOutAt: b.checkedOutAt,
  }));
}

/**
 * 슬롯 풀(전체 또는 memberType별) 하나에 대해 대기자를 신청 순서(FIFO)대로 승격한다.
 * 승격 기준(requirements.md 11번): 먼저 신청한 사람 우선, 동시각이면 id가 작은 예약 우선.
 */
async function promotePool(
  tx: PrismaClientOrTx,
  bookingDayId: string,
  capacity: number,
  memberType?: MemberType
): Promise<number> {
  const memberFilter = memberType ? { memberType } : {};
  const confirmedCount = await tx.booking.count({
    where: { bookingDayId, status: "CONFIRMED", ...memberFilter },
  });
  const remaining = capacity - confirmedCount;
  if (remaining <= 0) return 0;

  const waiting = await tx.booking.findMany({
    where: { bookingDayId, status: "WAITING", ...memberFilter },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: remaining,
    select: { id: true },
  });
  if (waiting.length === 0) return 0;

  await tx.booking.updateMany({
    where: { id: { in: waiting.map((w) => w.id) } },
    data: { status: "CONFIRMED" },
  });
  return waiting.length;
}

async function promoteWaitingBookingsInternal(bookingDayId: string, tx: PrismaClientOrTx) {
  const bookingDay = await tx.bookingDay.findUnique({ where: { id: bookingDayId } });
  if (!bookingDay) return { promotedCount: 0 };

  let promotedCount = 0;
  if (bookingDay.slotMode === "SEPARATED") {
    // 분리 슬롯: 연/캐주얼 풀 간 교차 승격 없음(requirements.md 9·11번)
    promotedCount += await promotePool(tx, bookingDayId, bookingDay.annualSlots, "ANNUAL");
    promotedCount += await promotePool(tx, bookingDayId, bookingDay.casualSlots, "CASUAL");
  } else {
    promotedCount += await promotePool(tx, bookingDayId, bookingDay.totalSlots);
  }
  return { promotedCount };
}

/**
 * 대기자 자동 승격(requirements.md 11·12번). 단독 호출 시 자체 트랜잭션으로 감싸고,
 * 취소/슬롯변경 흐름에서는 상위 트랜잭션(tx)에 참여한다(architecture.md 7장).
 */
export async function promoteWaitingBookings(bookingDayId: string, tx?: PrismaClientOrTx) {
  if (tx) {
    return promoteWaitingBookingsInternal(bookingDayId, tx);
  }
  return prisma.$transaction((trx) => promoteWaitingBookingsInternal(bookingDayId, trx));
}
