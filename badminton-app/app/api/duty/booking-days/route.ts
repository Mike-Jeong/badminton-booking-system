import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { requireActiveDutyPerson } from "@/lib/services/dutyAuthService";
import { listBookingDaysForDuty } from "@/lib/services/dutyBookingDayService";

/**
 * 듀티(GET) — 로그인한 계정에 배정된 예약일 목록(requirements.md 28.5번).
 * middleware는 서명/만료만 검증하므로(1차 방어선), 여기서 requireActiveDutyPerson으로
 * DutyPerson.isActive를 DB에서 재확인한 뒤 서비스 로직을 호출한다(2차·최종 방어선, D-38).
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const dutyPerson = await requireActiveDutyPerson(req);
  const bookingDays = await listBookingDaysForDuty(dutyPerson.id);
  return jsonOk(bookingDays);
});
