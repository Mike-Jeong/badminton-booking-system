import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { checkOutBooking } from "@/lib/services/bookingService";

/** 관리자(POST) — 수동 퇴장 처리(decisions.md D-27). 입장 처리된 예약에만 적용된다. */
export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const booking = await checkOutBooking(id);
    return jsonOk(booking);
  }
);
