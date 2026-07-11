import { notFound } from "next/navigation";
import { getBookingDayById } from "@/lib/services/bookingDayService";
import { NotFoundError } from "@/lib/errors";
import { BookingDayDetailView } from "@/components/public/BookingDayDetailView";

export const dynamic = "force-dynamic";

/**
 * 공개 예약일 상세 + 신청 폼 + 예약자 이름/상태 목록(requirements.md 2.1번 — 이름은 전체 공개,
 * 전화번호는 비공개). isOpen=false인 예약일은 존재 자체를 숨긴다(404).
 */
export default async function PublicBookingDayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let bookingDay;
  try {
    bookingDay = await getBookingDayById(id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  if (!bookingDay.isOpen) {
    notFound();
  }

  return <BookingDayDetailView bookingDay={bookingDay} />;
}
