/**
 * DutyBookingDayService (architecture.md 2장, requirements.md 28.5번, decisions.md D-38)
 * - listBookingDaysForDuty(dutyPersonId): 해당 계정에 배정된(dutyPersonId 일치) 예약일 전체
 * - getBookingDayForDuty(bookingDayId, dutyPersonId): 상세(기본 정보 + 참여자 이름/상태만)
 *
 * 읽기 전용 서비스다(생성/수정/취소 함수 없음). 참여자 명단은 이름/상태만 select한다 —
 * 전화번호(phoneEncrypted)/결제확인(paymentConfirmed)/참여자 코드는 애초에 select하지 않아
 * 응답에 구조적으로 포함될 수 없다(requirements.md 28.5번).
 */

import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";

/**
 * 로그인한 듀티 계정에 배정된 예약일 전체를 날짜 오름차순으로 반환한다.
 * 날짜 범위 필터(기본 "오늘부터 미래")는 CancelLookup과 동일하게 클라이언트 사이드에서
 * 처리하므로(decisions.md D-24) 여기서는 필터 없이 전체를 반환한다.
 */
export async function listBookingDaysForDuty(dutyPersonId: string) {
  return prisma.bookingDay.findMany({
    where: { dutyPersonId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * 예약일 상세. 자신에게 배정되지 않은 예약일(또는 존재하지 않는 id)은 NotFoundError(404)로
 * 처리한다(decisions.md D-38 — 403은 "그 id의 예약일이 존재한다"는 사실을 노출하므로 404로 통일).
 */
export async function getBookingDayForDuty(bookingDayId: string, dutyPersonId: string) {
  const bookingDay = await prisma.bookingDay.findUnique({ where: { id: bookingDayId } });
  if (!bookingDay || bookingDay.dutyPersonId !== dutyPersonId) {
    throw new NotFoundError("예약일을 찾을 수 없습니다.");
  }

  // 이름/상태만 select한다(전화번호·결제확인·참여자 코드는 select 자체를 하지 않는다).
  const bookings = await prisma.booking.findMany({
    where: { bookingDayId },
    select: { id: true, name: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  return { bookingDay, bookings };
}
