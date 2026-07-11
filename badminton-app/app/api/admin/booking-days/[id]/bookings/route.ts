import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { listBookingsForAdmin } from "@/lib/services/bookingService";

/** 관리자(GET) — 예약자 전체 목록(이름/전화번호/상태/유형/source, architecture.md 4장). */
export const GET = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const bookings = await listBookingsForAdmin(id);
    return jsonOk(bookings);
  }
);
