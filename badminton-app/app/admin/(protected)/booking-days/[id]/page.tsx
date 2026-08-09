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

  const confirmed = bookingDay.bookings.filter((b) => b.status === "CONFIRMED");
  const waiting = bookingDay.bookings.filter((b) => b.status === "WAITING");
  const confirmedCount = confirmed.length;
  const waitingCount = waiting.length;
  // CANCELLED는 getBookingDayById가 반환하는 bookingDay.bookings에 포함되지 않으므로
  // (D-17, DeleteBookingDayButton의 경고 카운트와 공유하는 목록이라 취소 건을 제외해둠)
  // 별도로 계산된 cancelledBookingsCount를 사용한다.
  const cancelledCount = bookingDay.cancelledBookingsCount;
  const confirmedAnnual = confirmed.filter((b) => b.memberType === "ANNUAL").length;
  const confirmedCasual = confirmed.filter((b) => b.memberType === "CASUAL").length;
  const waitingAnnual = waiting.filter((b) => b.memberType === "ANNUAL").length;
  const waitingCasual = waiting.filter((b) => b.memberType === "CASUAL").length;
  const adminBookings = await listBookingsForAdmin(id);
  // 총 입금 예정 금액(requirements.md 26.7번): CONFIRMED 예약만 합산하며(WAITING/CANCELLED 제외),
  // 이미 결제 확인된 건과 미확인 건을 구분하지 않는다.
  const totalPaymentAmountDue = adminBookings
    .filter((b) => b.status === "CONFIRMED")
    .reduce((sum, b) => sum + b.paymentAmountDue, 0);

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
        <div className="flex items-center gap-2">
          {bookingDay.isOpen ? <Badge>공개</Badge> : <Badge variant="secondary">비공개</Badge>}
          {bookingDay.clubDayPatternId && <Badge variant="outline">클럽데이</Badge>}
        </div>
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
            <p className="font-medium">
              {confirmedCount}명
              {bookingDay.slotMode === "SEPARATED" && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  (연 {confirmedAnnual}/{bookingDay.annualSlots} · 캐 {confirmedCasual}/{bookingDay.casualSlots})
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">취소 인원</p>
            <p className="font-medium">{cancelledCount}명</p>
          </div>
          <div>
            <p className="text-muted-foreground">대기 인원</p>
            <p className="font-medium">
              {waitingCount}명
              {bookingDay.slotMode === "SEPARATED" && (waitingAnnual > 0 || waitingCasual > 0) && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  (연 {waitingAnnual} · 캐 {waitingCasual})
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">총 입금 예정 금액</p>
            <p className="font-medium">${totalPaymentAmountDue}</p>
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
