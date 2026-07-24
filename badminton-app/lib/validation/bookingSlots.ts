/**
 * 예약일/클럽데이 패턴에 공통으로 쓰이는 시간·슬롯 검증 로직 (architecture.md 2장,
 * requirements.md 25.2번).
 * 원래 lib/services/bookingDayService.ts의 private 함수였던 assertTimeRange/validateSlots를
 * 이 파일로 추출해 export한다 — clubDayPatternService.ts도 예약일 생성과 동일한 검증
 * 규칙을 재사용하기 위함이다.
 */

import type { SlotMode } from "@prisma/client";
import { ValidationError } from "@/lib/errors";

const TIME_ONLY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeOnly(value: unknown): value is string {
  return typeof value === "string" && TIME_ONLY_PATTERN.test(value);
}

/** "HH:mm" 문자열은 zero-padded 24시간제라 사전식 비교가 곧 시간 순서 비교와 같다. */
export function assertTimeRange(startTime: string, endTime: string) {
  if (!isValidTimeOnly(startTime)) {
    throw new ValidationError("시작 시간(startTime)은 HH:mm 형식이어야 합니다.");
  }
  if (!isValidTimeOnly(endTime)) {
    throw new ValidationError("종료 시간(endTime)은 HH:mm 형식이어야 합니다.");
  }
  if (endTime <= startTime) {
    throw new ValidationError("종료 시간은 시작 시간보다 늦어야 합니다.");
  }
}

export function isValidSlotMode(value: unknown): value is SlotMode {
  return value === "SEPARATED" || value === "COMBINED";
}

export function validateSlots(input: {
  slotMode: SlotMode;
  totalSlots: number;
  annualSlots: number;
  casualSlots: number;
}) {
  if (!Number.isInteger(input.totalSlots) || input.totalSlots < 0) {
    throw new ValidationError("전체 슬롯 수(totalSlots)는 0 이상의 정수여야 합니다.");
  }

  if (input.slotMode === "SEPARATED") {
    if (!Number.isInteger(input.annualSlots) || input.annualSlots < 0) {
      throw new ValidationError("연 멤버 슬롯 수(annualSlots)는 0 이상의 정수여야 합니다.");
    }
    if (!Number.isInteger(input.casualSlots) || input.casualSlots < 0) {
      throw new ValidationError("캐주얼 슬롯 수(casualSlots)는 0 이상의 정수여야 합니다.");
    }
    if (input.annualSlots + input.casualSlots !== input.totalSlots) {
      throw new ValidationError(
        `분리 슬롯(SEPARATED) 모드에서는 annualSlots(${input.annualSlots}) + casualSlots(${input.casualSlots})가 totalSlots(${input.totalSlots})와 같아야 합니다.`
      );
    }
  }
}
