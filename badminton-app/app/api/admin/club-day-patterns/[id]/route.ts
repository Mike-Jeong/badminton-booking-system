import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { updateClubDayPattern, deleteClubDayPattern } from "@/lib/services/clubDayPatternService";

/** 관리자(PATCH) — 패턴 수정 및 활성/비활성 토글({ isActive }). */
export const PATCH = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    // 듀티 다중 배정(decisions.md D-39): 키 자체가 없으면 기존 배정을 건드리지 않고,
    // 빈 배열이면 전부 해제한다(부분 업데이트 컨벤션). 배열이 아닌 값은 거부한다.
    if (body.dutyPersonIds !== undefined && !Array.isArray(body.dutyPersonIds)) {
      throw new ValidationError("dutyPersonIds는 배열이어야 합니다.");
    }
    const pattern = await updateClubDayPattern(id, body);
    return jsonOk(pattern);
  }
);

/**
 * 관리자(DELETE) — 패턴 소프트 삭제(deletedAt 기록, 물리적 삭제 아님, decisions.md D-29).
 * 활성/비활성 토글은 PATCH { isActive }로 별도 처리한다.
 */
export const DELETE = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const result = await deleteClubDayPattern(id);
    return jsonOk(result);
  }
);
