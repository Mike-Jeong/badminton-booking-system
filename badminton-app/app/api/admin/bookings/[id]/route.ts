import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { adminChangeBookingStatus } from "@/lib/services/bookingService";
import { ValidationError } from "@/lib/errors";
import type { BookingStatus } from "@prisma/client";

/** 관리자(PATCH) — 대기 예약 승인(WAITING -> CONFIRMED만 지원, requirements.md 10번). */
export const PATCH = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body.status !== "string") {
      throw new ValidationError("status가 필요합니다.");
    }

    const booking = await adminChangeBookingStatus(id, body.status as BookingStatus);
    return jsonOk(booking);
  }
);
