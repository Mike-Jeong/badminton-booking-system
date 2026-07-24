import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { updateClubDayPattern, deleteClubDayPattern } from "@/lib/services/clubDayPatternService";

/** 관리자(PATCH) — 패턴 수정 및 활성/비활성 토글({ isActive }). */
export const PATCH = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
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
