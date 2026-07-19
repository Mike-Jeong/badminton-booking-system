import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingDayById } from "@/lib/services/bookingDayService";
import { listBookingsForAdmin } from "@/lib/services/bookingService";
import { NotFoundError } from "@/lib/errors";
import { formatDateOnlyInTimeZone, getDayOfWeekLabelKo } from "@/lib/timezone";
import { CheckInScanner } from "@/components/admin/CheckInScanner";
import { CheckInRoster } from "@/components/admin/CheckInRoster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * 예약일별 체크인 스캔 화면(decisions.md D-27). 카메라로 예약별 QR을 스캔해 입장/퇴장을
 * 자동으로 구분 처리하고, 그 날짜의 확정 예약자 실시간 명단을 함께 보여준다.
 */
export default async function CheckInScanPage({
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

  const allBookings = await listBookingsForAdmin(id);
  const confirmedBookings = allBookings.filter((b) => b.status === "CONFIRMED");

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/booking-days/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← 예약일 상세로
        </Link>
        <h1 className="text-2xl font-bold">
          체크인 스캔 — {formatDateOnlyInTimeZone(bookingDay.date)} ({getDayOfWeekLabelKo(bookingDay.dayOfWeek)})
          {bookingDay.label ? ` · ${bookingDay.label}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {bookingDay.location} · {bookingDay.startTime} ~ {bookingDay.endTime}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>QR 스캔</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckInScanner bookingDayId={id} />
        </CardContent>
      </Card>

      <CheckInRoster bookings={confirmedBookings} />
    </div>
  );
}
