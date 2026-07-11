import { listBookingDays } from "@/lib/services/bookingDayService";
import { BookingDayListView } from "@/components/public/BookingDayListView";

export const dynamic = "force-dynamic";

// 공개 예약일 목록. isOpen=true인 예약일만 노출한다(requirements.md 3번, architecture.md 1장).
export default async function PublicBookingDaysPage() {
  const bookingDays = await listBookingDays({ isOpen: true });

  return <BookingDayListView bookingDays={bookingDays} />;
}
