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
import { getAssignableDutyPersons } from "@/lib/services/dutyPersonService";

export interface ClubDayPatternInput {
  name?: string | null;
  dayOfWeek: number; // 0(일)~6(토)
  label?: string | null;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm", startTime보다 늦어야 함
  location: string;
  dutyPerson: string;
  /**
   * 배정할 듀티 담당자 계정 id 목록(0명, 1명, N명 모두 가능 — 인원 상한 없음,
   * requirements.md 28.3번, decisions.md D-39). 1개 이상이면 dutyPerson 텍스트는 그 계정들의
   * name을 이름순으로 정렬해 ", "로 이어붙인 값으로 서버가 덮어쓴다. 이 배정은 클럽데이 자동
   * 생성 시 생성되는 BookingDay에 전원 그대로 복사된다(ClubDayGenerationService).
   */
  dutyPersonIds?: string[];
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
  /**
   * 배정할 듀티 담당자 계정 id 목록(decisions.md D-39). 키 자체가 없으면 기존 배정을 건드리지
   * 않고, 빈 배열 []을 명시하면 배정을 전부 해제한다. 1개 이상이면 기존 배정을 전부 지우고
   * 통째로 다시 쓰며, dutyPerson 텍스트도 이름순 결합값으로 동기화한다.
   */
  dutyPersonIds?: string[];
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

  const dutyPersonIds = input.dutyPersonIds ?? [];

  // 검증 + 패턴 생성 + 조인 테이블 쓰기를 하나의 트랜잭션으로 묶는다(decisions.md D-39,
  // BookingDayService.createBookingDay와 동일한 패턴).
  return prisma.$transaction(async (tx) => {
    // 계정을 1명 이상 선택한 경우 dutyPerson 텍스트를 그 계정들의 name(이름순)으로 맞춰
    // 저장한다(두 값 동기화, D-36·D-39). 0명이면 관리자가 입력한 텍스트를 그대로 저장한다.
    const accounts = await getAssignableDutyPersons(dutyPersonIds, tx);

    const pattern = await tx.clubDayPattern.create({
      data: {
        name: input.name?.trim() ? input.name.trim() : null,
        dayOfWeek: input.dayOfWeek,
        label: input.label?.trim() ? input.label.trim() : null,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location.trim(),
        dutyPerson:
          accounts.length > 0
            ? accounts.map((a) => a.name).join(", ")
            : input.dutyPerson.trim(),
        totalSlots,
        annualSlots,
        casualSlots,
        slotMode,
        autoAssignMonthlyMembers: input.autoAssignMonthlyMembers ?? true,
        isActive: input.isActive ?? true,
      },
    });

    if (accounts.length > 0) {
      await tx.clubDayPatternDutyPerson.createMany({
        data: accounts.map((a) => ({ clubDayPatternId: pattern.id, dutyPersonId: a.id })),
      });
    }

    // 응답 DTO는 단일 dutyPersonId 대신 배정된 계정 배열을 담는다(architecture.md 6장, D-39).
    return { ...pattern, dutyPersonIds: accounts.map((a) => a.id), dutyPersons: accounts };
  });
}

/**
 * 클럽데이 패턴 수정(부분 업데이트). isActive 토글(활성화/비활성화)도 이 함수로 처리한다
 * (별도 activate/deactivate 함수 없음, updateMonthlyMember와 동일 패턴).
 */
export async function updateClubDayPattern(id: string, input: ClubDayPatternUpdateInput) {
  // 조인 테이블 쓰기(삭제 후 재생성)가 추가되며 패턴 update와 원자성을 맞춰야 하므로
  // 전체를 하나의 트랜잭션으로 감싼다(decisions.md D-39 — 기존에는 트랜잭션이 없었다).
  return prisma.$transaction(async (tx) => {
    const existing = await tx.clubDayPattern.findUnique({ where: { id } });
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
    const totalSlots =
      input.totalSlots !== undefined ? Number(input.totalSlots) : existing.totalSlots;
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

    // 듀티 계정 배정(requirements.md 28.3번, decisions.md D-39). dutyPersonIds 키 자체가 없으면
    // 기존 배정을 건드리지 않고, 전달되면 기존 배정을 전부 지운 뒤 통째로 다시 쓴다.
    // 열린 트랜잭션 안이므로 tx를 그대로 넘긴다(P2028 방지).
    let dutyPersonText = input.dutyPerson !== undefined ? input.dutyPerson.trim() : undefined;
    const nextDutyPersons =
      input.dutyPersonIds !== undefined
        ? await getAssignableDutyPersons(input.dutyPersonIds, tx)
        : null;
    if (nextDutyPersons !== null && nextDutyPersons.length > 0) {
      dutyPersonText = nextDutyPersons.map((a) => a.name).join(", ");
    }

    const pattern = await tx.clubDayPattern.update({
      where: { id },
      data: {
        name: input.name !== undefined ? (input.name?.trim() ? input.name.trim() : null) : undefined,
        dayOfWeek: input.dayOfWeek,
        label:
          input.label !== undefined ? (input.label?.trim() ? input.label.trim() : null) : undefined,
        startTime,
        endTime,
        location: input.location !== undefined ? input.location.trim() : undefined,
        dutyPerson: dutyPersonText,
        totalSlots,
        annualSlots,
        casualSlots,
        slotMode,
        autoAssignMonthlyMembers: input.autoAssignMonthlyMembers,
        isActive: input.isActive,
      },
    });

    if (nextDutyPersons !== null) {
      await tx.clubDayPatternDutyPerson.deleteMany({ where: { clubDayPatternId: id } });
      if (nextDutyPersons.length > 0) {
        await tx.clubDayPatternDutyPerson.createMany({
          data: nextDutyPersons.map((a) => ({ clubDayPatternId: id, dutyPersonId: a.id })),
        });
      }
    }

    // 응답 DTO는 단일 dutyPersonId 대신 배정된 계정 배열을 담는다(architecture.md 6장, D-39).
    // dutyPersonIds 키가 없어 기존 배정을 그대로 둔 경우에는 현재 배정을 다시 읽어 담는다.
    const dutyPersons =
      nextDutyPersons ??
      (
        await tx.clubDayPatternDutyPerson.findMany({
          where: { clubDayPatternId: id },
          include: { dutyPerson: { select: { id: true, name: true, isActive: true } } },
          orderBy: { dutyPerson: { name: "asc" } },
        })
      ).map((a) => a.dutyPerson);

    return { ...pattern, dutyPersonIds: dutyPersons.map((a) => a.id), dutyPersons };
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
 * 관리자 화면의 다중 선택 체크박스 초기 상태 렌더링을 위해 배정된 듀티 계정도 함께 조회한다
 * (decisions.md D-39).
 */
export async function listClubDayPatterns() {
  return prisma.clubDayPattern.findMany({
    where: { deletedAt: null },
    include: { dutyPersonAssignments: { include: { dutyPerson: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { createdAt: "asc" }],
  });
}
