import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { getBookingDayById } from "@/lib/services/bookingDayService";
import { NotFoundError } from "@/lib/errors";

/**
 * 공개(GET) 예약일 상세 — 전화번호 제외.
 * Phase 2 이전이라 예약자 목록(bookings)은 아직 비어 있을 수 있다.
 * isOpen=false인 예약일은 공개 화면에 노출하지 않는다(존재 자체를 숨김, 404 처리).
 */
export const GET = withApiHandler<{ id: string }>(async (_req, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  const bookingDay = await getBookingDayById(id);
  if (!bookingDay.isOpen) {
    throw new NotFoundError("예약일을 찾을 수 없습니다.");
  }
  return jsonOk(bookingDay);
});
