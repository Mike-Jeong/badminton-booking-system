/**
 * ClubDayPatternService (architecture.md 2장, requirements.md 25.2번, decisions.md D-28~D-30)
 * - createClubDayPattern / updateClubDayPattern / deleteClubDayPattern / listClubDayPatterns
 * - "클럽데이 패턴"은 요일별 반복 규칙이다. 크론(ClubDayGenerationService)이 이 패턴을 읽어
 *   매일 BookingDay를 생성한다.
 * - 삭제는 물리적 삭제가 아니라 deletedAt 기록(소프트 삭제)이다(decisions.md D-29). 비활성화는
 *   isActive 토글로 별개 액션이며, updateClubDayPattern으로 처리한다(deleteMonthlyMember와
 *   달리 완전 삭제를 허용하지 않는다 — BookingDay.clubDayPatternId가 약한 참조로 가리키는
 *   대상이 갑자기 사라지지 않도록 하기 위함, decisions.md D-28).
 */

import type { SlotMode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { assertTimeRange, isValidSlotMode, validateSlots } from "@/lib/validation/bookingSlots";

export interface ClubDayPatternInput {
  name?: string | null;
  dayOfWeek: number; // 0(일)~6(토)
  label?: string | null;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm", startTime보다 늦어야 함
  location: string;
  dutyPerson: string;
  totalSlots: number;
  annualSlots?: number;
  casualSlots?: number;
  slotMode: SlotMode;
  autoAssignMonthlyMembers?: boolean;
  isActive?: boolean;
}

export interface ClubDayPatternUpdateInput {
  name?: string | null;
  dayOfWeek?: number;
  label?: string | null;
  startTime?: string;
  endTime?: string;
  location?: string;
  dutyPerson?: string;
  totalSlots?: number;
  annualSlots?: number;
  casualSlots?: number;
  slotMode?: SlotMode;
  autoAssignMonthlyMembers?: boolean;
  isActive?: boolean;
}

function isValidDayOfWeek(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6;
}

/**
 * 클럽데이 패턴 등록(requirements.md 25.2번). 시간/슬롯 검증은 예약일 생성
 * (bookingDayService.createBookingDay)과 동일한 규칙을 lib/validation/bookingSlots.ts에서
 * 재사용한다. isActive 기본값 true, autoAssignMonthlyMembers 기본값 true(decisions.md D-30).
 */
export async function createClubDayPattern(input: ClubDayPatternInput) {
  if (!isValidDayOfWeek(input.dayOfWeek)) {
    throw new ValidationError("dayOfWeek는 0(일)~6(토) 사이여야 합니다.");
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

  return prisma.clubDayPattern.create({
    data: {
      name: input.name?.trim() ? input.name.trim() : null,
      dayOfWeek: input.dayOfWeek,
      label: input.label?.trim() ? input.label.trim() : null,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location.trim(),
      dutyPerson: input.dutyPerson.trim(),
      totalSlots,
      annualSlots,
      casualSlots,
      slotMode,
      autoAssignMonthlyMembers: input.autoAssignMonthlyMembers ?? true,
      isActive: input.isActive ?? true,
    },
  });
}

/**
 * 클럽데이 패턴 수정(부분 업데이트). isActive 토글(활성화/비활성화)도 이 함수로 처리한다
 * (별도 activate/deactivate 함수 없음, updateMonthlyMember와 동일 패턴).
 */
export async function updateClubDayPattern(id: string, input: ClubDayPatternUpdateInput) {
  const existing = await prisma.clubDayPattern.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("클럽데이 패턴을 찾을 수 없습니다.");
  }

  if (input.dayOfWeek !== undefined && !isValidDayOfWeek(input.dayOfWeek)) {
    throw new ValidationError("dayOfWeek는 0(일)~6(토) 사이여야 합니다.");
  }
  if (input.slotMode !== undefined && !isValidSlotMode(input.slotMode)) {
    throw new ValidationError("slotMode는 SEPARATED 또는 COMBINED여야 합니다.");
  }

  const slotMode = input.slotMode ?? existing.slotMode;
  const totalSlots = input.totalSlots !== undefined ? Number(input.totalSlots) : existing.totalSlots;
  const annualSlots =
    slotMode === "SEPARATED" ? Number(input.annualSlots ?? existing.annualSlots) : 0;
  const casualSlots =
    slotMode === "SEPARATED" ? Number(input.casualSlots ?? existing.casualSlots) : 0;

  validateSlots({ slotMode, totalSlots, annualSlots, casualSlots });

  const startTime = input.startTime ?? existing.startTime;
  const endTime = input.endTime ?? existing.endTime;
  assertTimeRange(startTime, endTime);

  if (input.location !== undefined && !input.location.trim()) {
    throw new ValidationError("장소(location)는 필수입니다.");
  }
  if (input.dutyPerson !== undefined && !input.dutyPerson.trim()) {
    throw new ValidationError("듀티 담당자(dutyPerson)는 필수입니다.");
  }

  return prisma.clubDayPattern.update({
    where: { id },
    data: {
      name: input.name !== undefined ? (input.name?.trim() ? input.name.trim() : null) : undefined,
      dayOfWeek: input.dayOfWeek,
      label: input.label !== undefined ? (input.label?.trim() ? input.label.trim() : null) : undefined,
      startTime,
      endTime,
      location: input.location !== undefined ? input.location.trim() : undefined,
      dutyPerson: input.dutyPerson !== undefined ? input.dutyPerson.trim() : undefined,
      totalSlots,
      annualSlots,
      casualSlots,
      slotMode,
      autoAssignMonthlyMembers: input.autoAssignMonthlyMembers,
      isActive: input.isActive,
    },
  });
}

/**
 * 클럽데이 패턴 "삭제"(decisions.md D-29). 물리적 삭제 없음 — deletedAt에 시각을 기록하고
 * isActive도 함께 false로 저장한다(삭제된 패턴은 항상 비활성 상태이기도 하다).
 * prisma.clubDayPattern.delete(...)는 어떤 경우에도 호출하지 않는다.
 */
export async function deleteClubDayPattern(id: string) {
  const existing = await prisma.clubDayPattern.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("클럽데이 패턴을 찾을 수 없습니다.");
  }
  await prisma.clubDayPattern.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  return { id };
}

/**
 * 관리자용 클럽데이 패턴 목록. 삭제된(deletedAt이 있는) 패턴은 기본적으로 제외한다
 * (decisions.md D-29). 삭제된 패턴을 다시 조회하는 옵션은 이번 범위에 포함하지 않는다.
 */
export async function listClubDayPatterns() {
  return prisma.clubDayPattern.findMany({
    where: { deletedAt: null },
    orderBy: [{ dayOfWeek: "asc" }, { createdAt: "asc" }],
  });
}
