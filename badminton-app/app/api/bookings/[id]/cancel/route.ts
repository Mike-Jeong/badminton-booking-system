import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { cancelBooking } from "@/lib/services/bookingService";
import { ValidationError } from "@/lib/errors";

/** 공개(POST) — 사용자 예약 취소(requirements.md 14.2번). bookingId + phone 일치해야 취소된다. */
export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body.phone !== "string") {
      throw new ValidationError("phone이 필요합니다.");
    }

    const booking = await cancelBooking(id, body.phone);
    return jsonOk(booking);
  }
);
