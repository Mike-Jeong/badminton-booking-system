import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { checkInBooking, resetCheckInStatus } from "@/lib/services/bookingService";

/** 관리자(POST) — 수동 입장 처리(decisions.md D-27). CONFIRMED 예약에만 적용된다. */
export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const booking = await checkInBooking(id);
    return jsonOk(booking);
  }
);

/** 관리자(DELETE) — 입장/퇴장 처리를 초기화(둘 다 null)한다. 스캔 실수 등을 정정하는 용도. */
export const DELETE = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const booking = await resetCheckInStatus(id);
    return jsonOk(booking);
  }
);
