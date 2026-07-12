import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { updateMonthlyMember, deactivateMonthlyMember } from "@/lib/services/monthlyMemberService";

/** 관리자(PATCH) — 월 멤버 수정. 연도/월/요일/활성여부/메모 모두 변경 가능하다(decisions.md D-21). 대상(연 멤버)만 불변. */
export const PATCH = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const member = await updateMonthlyMember(id, body);
    return jsonOk(member);
  }
);

/** 관리자(DELETE) — "삭제"는 실제로 isActive=false 처리(하드 삭제 없음, decisions.md D-07). */
export const DELETE = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const member = await deactivateMonthlyMember(id);
    return jsonOk(member);
  }
);
