import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { adminCancelBooking } from "@/lib/services/bookingService";

/** 관리자(POST) — 예약 취소 처리. 전화번호 검증 없이 취소하고, 대기자 자동 승격은 동일하게 실행. */
export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const booking = await adminCancelBooking(id);
    return jsonOk(booking);
  }
);
