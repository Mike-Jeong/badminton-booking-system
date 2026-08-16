/**
 * PaymentProofService (architecture.md 2장, requirements.md 19·26번, decisions.md D-31·D-32)
 * - isPaymentConfirmationRequired / batchComputePaymentConfirmationRequirements: 결제 확인 대상 판정
 * - uploadPaymentProof: 회원 셀프/관리자 대리 업로드(재업로드는 교체)
 * - getPaymentProof: 관리자 전용 이미지 조회(별도 쿼리로만 가져와 목록 응답 비대화 방지)
 * - setPaymentConfirmation: 관리자 전용 확인/확인취소
 */

import type { Booking, BookingDay, MemberType, ProofUploadSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import { normalizePhone } from "@/lib/normalize";
import { hashPhone } from "@/lib/security/phoneCrypto";
import { formatDateOnlyInTimeZone } from "@/lib/timezone";
import type { PrismaClientOrTx } from "@/lib/services/annualMemberService";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PROOF_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB 상한(decisions.md D-32)

// 입금 금액 고정 상수(requirements.md 26.7번). 관리자가 변경하는 UI는 이번 범위에 없음(YAGNI).
export const CASUAL_PAYMENT_AMOUNT_USD = 16;
export const ANNUAL_PAYMENT_AMOUNT_USD = 13;

/**
 * 입금 예정 금액(requirements.md 19·26.7번). 순수 함수, DB 조회 없음. 결제 확인 대상 여부
 * (isPaymentConfirmationRequired/batchComputePaymentConfirmationRequirements)에 고정 금액을
 * 매핑할 뿐, 새로운 판정 로직이 아니다.
 */
export function getPaymentAmountDue(
  memberType: MemberType,
  paymentConfirmationRequired: boolean
): number {
  if (!paymentConfirmationRequired) {
    return 0;
  }
  return memberType === "CASUAL" ? CASUAL_PAYMENT_AMOUNT_USD : ANNUAL_PAYMENT_AMOUNT_USD;
}

/**
 * 단건 판정(requirements.md 19·26번). CASUAL이거나 매칭된 연 멤버가 없으면 항상 대상(true).
 * ANNUAL이면 이 예약일의 (연도, 월, 요일)과 일치하는 활성 MonthlyMember가 있는지 조회해
 * 있으면 면제(false), 없으면 대상(true)을 반환한다.
 */
export async function isPaymentConfirmationRequired(
  booking: Pick<Booking, "memberType" | "matchedAnnualMemberId">,
  bookingDay: Pick<BookingDay, "date" | "dayOfWeek">,
  client: PrismaClientOrTx = prisma
): Promise<boolean> {
  if (booking.memberType !== "ANNUAL" || !booking.matchedAnnualMemberId) {
    return true;
  }

  const [year, month] = formatDateOnlyInTimeZone(bookingDay.date).split("-").map(Number);
  const matched = await client.monthlyMember.findFirst({
    where: {
      annualMemberId: booking.matchedAnnualMemberId,
      isActive: true,
      year,
      month,
      dayOfWeek: bookingDay.dayOfWeek,
    },
    select: { id: true },
  });

  return !matched;
}

export interface BookingForPaymentCheck {
  id: string;
  memberType: MemberType;
  matchedAnnualMemberId: string | null;
  bookingDay: Pick<BookingDay, "date" | "dayOfWeek">;
}

/**
 * N+1 회피용 배치 버전(architecture.md 2장). 관련된 matchedAnnualMemberId 전체에 대해
 * monthlyMember.findMany를 단 1회만 호출해 "annualMemberId -> 활성 (연-월-요일) 집합" 맵을
 * 만든 뒤, 각 예약을 자신의 bookingDay 기준으로 메모리에서 판정한다. 같은 bookingDayId의
 * 목록(listBookingsForAdmin)이든 여러 bookingDay에 걸친 목록(lookupBookingsByPhone)이든
 * 이 함수 하나로 처리하며, 쿼리 수는 예약 건수와 무관하게 O(1)이다.
 */
export async function batchComputePaymentConfirmationRequirements(
  bookings: BookingForPaymentCheck[],
  client: PrismaClientOrTx = prisma
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();

  const annualMemberIds = Array.from(
    new Set(
      bookings
        .filter((b) => b.memberType === "ANNUAL" && b.matchedAnnualMemberId)
        .map((b) => b.matchedAnnualMemberId as string)
    )
  );

  const exemptionMap = new Map<string, Set<string>>();
  if (annualMemberIds.length > 0) {
    const monthlyMembers = await client.monthlyMember.findMany({
      where: { annualMemberId: { in: annualMemberIds }, isActive: true },
      select: { annualMemberId: true, year: true, month: true, dayOfWeek: true },
    });
    for (const mm of monthlyMembers) {
      const key = `${mm.year}-${mm.month}-${mm.dayOfWeek}`;
      const set = exemptionMap.get(mm.annualMemberId) ?? new Set<string>();
      set.add(key);
      exemptionMap.set(mm.annualMemberId, set);
    }
  }

  for (const booking of bookings) {
    if (booking.memberType !== "ANNUAL" || !booking.matchedAnnualMemberId) {
      result.set(booking.id, true);
      continue;
    }
    const [year, month] = formatDateOnlyInTimeZone(booking.bookingDay.date).split("-").map(Number);
    const key = `${year}-${month}-${booking.bookingDay.dayOfWeek}`;
    const exempt = exemptionMap.get(booking.matchedAnnualMemberId)?.has(key) ?? false;
    result.set(booking.id, !exempt);
  }

  return result;
}

/**
 * 결제 증빙 업로드(requirements.md 26.3·19번). uploadedBy === "SELF"면 phoneHash 검증(취소와
 * 동일 패턴)을 거치고, "ADMIN"이면 생략한다. CONFIRMED 상태의 예약만 허용하며(WAITING·CANCELLED
 * 모두 거부), 예약일 종료 여부(isBookingDayEnded)는 검사하지 않는다 — 결제 증빙은 세션 종료
 * 후에도 항상 업로드 가능하다. 기존 증빙이 있으면 교체(재업로드), 없으면 새로 생성한다.
 */
export async function uploadPaymentProof(
  bookingId: string,
  file: File,
  uploadedBy: ProofUploadSource,
  phone?: string
) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError("예약을 찾을 수 없습니다.");
  }

  if (uploadedBy === "SELF") {
    const normalizedPhone = normalizePhone(phone ?? "");
    if (!normalizedPhone) {
      throw new ValidationError("전화번호를 입력해주세요.");
    }
    if (hashPhone(normalizedPhone) !== booking.phoneHash) {
      throw new ConflictError("전화번호가 일치하지 않아 업로드할 수 없습니다.");
    }
  }

  if (booking.status !== "CONFIRMED") {
    throw new ConflictError("확정된 예약만 결제 증빙을 업로드할 수 있습니다.");
  }

  if (!(file instanceof File)) {
    throw new ValidationError("file이 필요합니다.");
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new ValidationError("이미지 파일(jpeg/png/webp)만 업로드할 수 있습니다.");
  }
  if (file.size > MAX_PROOF_FILE_SIZE_BYTES) {
    throw new ValidationError("파일 크기는 2MB를 초과할 수 없습니다.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageData = buffer.toString("base64");

  const proof = await prisma.paymentProof.upsert({
    where: { bookingId },
    create: { bookingId, imageData, mimeType: file.type, uploadedBy },
    update: { imageData, mimeType: file.type, uploadedBy },
  });

  return {
    id: proof.id,
    bookingId: proof.bookingId,
    uploadedBy: proof.uploadedBy,
    updatedAt: proof.updatedAt,
  };
}

/**
 * 관리자 전용 증빙 이미지 조회(architecture.md 2·4장). Booking과 분리된 모델을 명시적으로
 * 호출했을 때만 조회한다(D-31 — 목록 응답 비대화 방지).
 */
export async function getPaymentProof(bookingId: string) {
  const proof = await prisma.paymentProof.findUnique({ where: { bookingId } });
  if (!proof) {
    throw new NotFoundError("결제 증빙을 찾을 수 없습니다.");
  }
  return {
    imageDataUrl: `data:${proof.mimeType};base64,${proof.imageData}`,
    uploadedBy: proof.uploadedBy,
    updatedAt: proof.updatedAt,
  };
}

/**
 * 관리자 전용 확인/확인취소(requirements.md 26.4번). 증빙 이미지 유무와 무관하게 항상
 * 허용한다(대면 확인 등). 확인 취소 시 paymentConfirmedAt은 다시 null로 되돌아간다.
 */
export async function setPaymentConfirmation(bookingId: string, confirmed: boolean) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError("예약을 찾을 수 없습니다.");
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentConfirmed: confirmed,
      paymentConfirmedAt: confirmed ? new Date() : null,
    },
  });

  return {
    id: updated.id,
    paymentConfirmed: updated.paymentConfirmed,
    paymentConfirmedAt: updated.paymentConfirmedAt,
  };
}
