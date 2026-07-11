import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingDayById } from "@/lib/services/bookingDayService";
import { listBookingsForAdmin } from "@/lib/services/bookingService";
import { NotFoundError } from "@/lib/errors";
import { formatDateOnlyInTimeZone, getDayOfWeekLabelKo } from "@/lib/timezone";
import { EditBookingDayForm } from "@/components/admin/EditBookingDayForm";
import { DeleteBookingDayButton } from "@/components/admin/DeleteBookingDayButton";
import { AdminBookingsPanel } from "@/components/admin/AdminBookingsPanel";
import { ApplyMonthlyMembersButton } from "@/components/admin/ApplyMonthlyMembersButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminBookingDayDetailPage({
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

  const confirmedCount = bookingDay.bookings.filter((b) => b.status === "CONFIRMED").length;
  const waitingCount = bookingDay.bookings.filter((b) => b.status === "WAITING").length;
  const adminBookings = await listBookingsForAdmin(id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/booking-days" className="text-sm text-muted-foreground hover:underline">
            ← 예약일 목록
          </Link>
          <h1 className="text-2xl font-bold">
            {formatDateOnlyInTimeZone(bookingDay.date)} ({getDayOfWeekLabelKo(bookingDay.dayOfWeek)})
            {bookingDay.label ? ` · ${bookingDay.label}` : ""}
          </h1>
        </div>
        {bookingDay.isOpen ? <Badge>공개</Badge> : <Badge variant="secondary">비공개</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">시간</p>
            <p className="font-medium">
              {bookingDay.startTime} ~ {bookingDay.endTime}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">장소</p>
            <p className="font-medium">{bookingDay.location}</p>
          </div>
          <div>
            <p className="text-muted-foreground">듀티 담당자</p>
            <p className="font-medium">{bookingDay.dutyPerson}</p>
          </div>
          <div>
            <p className="text-muted-foreground">슬롯 정책</p>
            <p className="font-medium">{bookingDay.slotMode === "SEPARATED" ? "분리" : "통합"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">슬롯</p>
            <p className="font-medium">
              {bookingDay.slotMode === "SEPARATED"
                ? `연 ${bookingDay.annualSlots} + 캐 ${bookingDay.casualSlots} = ${bookingDay.totalSlots}`
                : `${bookingDay.totalSlots}`}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">확정 인원</p>
            <p className="font-medium">{confirmedCount}명</p>
          </div>
          <div>
            <p className="text-muted-foreground">대기 인원</p>
            <p className="font-medium">{waitingCount}명</p>
          </div>
        </CardContent>
      </Card>

      <ApplyMonthlyMembersButton bookingDayId={bookingDay.id} />

      <AdminBookingsPanel bookingDayId={bookingDay.id} bookings={adminBookings} />

      <EditBookingDayForm
        bookingDay={{
          id: bookingDay.id,
          label: bookingDay.label,
          startTime: bookingDay.startTime,
          endTime: bookingDay.endTime,
          location: bookingDay.location,
          dutyPerson: bookingDay.dutyPerson,
          totalSlots: bookingDay.totalSlots,
          annualSlots: bookingDay.annualSlots,
          casualSlots: bookingDay.casualSlots,
          slotMode: bookingDay.slotMode,
          isOpen: bookingDay.isOpen,
        }}
        confirmedCount={confirmedCount}
      />

      <DeleteBookingDayButton id={bookingDay.id} bookingCount={bookingDay.bookings.length} />
    </div>
  );
}
