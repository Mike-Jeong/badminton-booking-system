import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { lookupBookingsByPhone } from "@/lib/services/bookingService";
import { ValidationError } from "@/lib/errors";

/** 공개(POST) — 전화번호로 본인 예약 목록 조회(requirements.md 14.1번). */
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.phone !== "string") {
    throw new ValidationError("phone이 필요합니다.");
  }

  const bookings = await lookupBookingsByPhone(body.phone);
  return jsonOk(bookings);
});
