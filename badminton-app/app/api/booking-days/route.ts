import { withApiHandler, jsonOk } from "@/lib/http";
import { listBookingDays } from "@/lib/services/bookingDayService";

/** 공개(GET) — isOpen=true인 예약일만 노출 */
export const GET = withApiHandler(async () => {
  const bookingDays = await listBookingDays({ isOpen: true });
  return jsonOk(bookingDays);
});
