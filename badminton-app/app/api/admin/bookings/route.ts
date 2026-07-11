import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { adminCreateBooking } from "@/lib/services/bookingService";
import { ValidationError } from "@/lib/errors";

/** 관리자(POST) — 수동 예약 추가(source=ADMIN). 중복/재예약/슬롯 판정은 사용자 예약과 동일. */
export const POST = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.bookingDayId !== "string" ||
    typeof body.name !== "string" ||
    typeof body.phone !== "string"
  ) {
    throw new ValidationError("bookingDayId, name, phone이 필요합니다.");
  }

  const booking = await adminCreateBooking(body.bookingDayId, body.name, body.phone);
  return jsonOk(booking, 201);
});
