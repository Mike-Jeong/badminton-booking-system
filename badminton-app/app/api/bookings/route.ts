import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { createBooking } from "@/lib/services/bookingService";
import { ValidationError } from "@/lib/errors";

/** 공개(POST) — 사용자 예약 신청. name/phone/bookingDayId만 받는다(memberType은 서버가 판정). */
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.bookingDayId !== "string" ||
    typeof body.name !== "string" ||
    typeof body.phone !== "string"
  ) {
    throw new ValidationError("bookingDayId, name, phone이 필요합니다.");
  }

  const booking = await createBooking({
    bookingDayId: body.bookingDayId,
    name: body.name,
    phone: body.phone,
    source: "USER",
  });

  return jsonOk(booking, 201);
});
