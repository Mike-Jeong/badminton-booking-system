import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { applyMonthlyMembersToBookingDay } from "@/lib/services/monthlyMemberService";

/** 관리자(POST) — 해당 예약일에 월 멤버 자동 배정을 재실행(재실행 안전 — 중복 생성 없음). */
export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const result = await applyMonthlyMembersToBookingDay(id);
    return jsonOk(result);
  }
);
