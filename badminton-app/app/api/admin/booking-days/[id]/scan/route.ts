import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { scanBookingCheckIn } from "@/lib/services/bookingService";
import { ValidationError } from "@/lib/errors";

/**
 * 관리자(POST) — QR 스캔으로 입장/퇴장을 처리한다(decisions.md D-27).
 * body: { bookingId }. 현재 상태를 보고 입장/퇴장을 자동 판단하며, 스캔된 예약이 이
 * 예약일([id])의 예약이 아니면 거부한다.
 */
export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id: bookingDayId } = await context.params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body.bookingId !== "string") {
      throw new ValidationError("bookingId가 필요합니다.");
    }

    const result = await scanBookingCheckIn(body.bookingId, bookingDayId);
    return jsonOk(result);
  }
);
