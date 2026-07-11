import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingDayById } from "@/lib/services/bookingDayService";
import { NotFoundError } from "@/lib/errors";
import { formatDateOnlyInTimeZone, getDayOfWeekLabelKo } from "@/lib/timezone";
import { BookingForm } from "@/components/public/BookingForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  const confirmed = bookingDay.bookings.filter((b) => b.status === "CONFIRMED");
  const waiting = bookingDay.bookings.filter((b) => b.status === "WAITING");

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← 예약 가능한 날짜
        </Link>
        <h1 className="text-2xl font-bold">
          {formatDateOnlyInTimeZone(bookingDay.date)} ({getDayOfWeekLabelKo(bookingDay.dayOfWeek)})
          {bookingDay.label ? ` · ${bookingDay.label}` : ""}
        </h1>
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
            <p className="text-muted-foreground">슬롯</p>
            <p className="font-medium">
              {bookingDay.slotMode === "SEPARATED"
                ? `연 ${bookingDay.annualSlots} + 캐 ${bookingDay.casualSlots} = ${bookingDay.totalSlots}`
                : `${bookingDay.totalSlots}`}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">확정/대기</p>
            <p className="font-medium">
              {confirmed.length}명 확정 · {waiting.length}명 대기
            </p>
          </div>
        </CardContent>
      </Card>

      <BookingForm bookingDayId={bookingDay.id} />

      <Card>
        <CardHeader>
          <CardTitle>예약자 명단 ({bookingDay.bookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookingDay.bookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                    아직 예약자가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {bookingDay.bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>
                    {b.status === "CONFIRMED" ? (
                      <Badge>확정</Badge>
                    ) : (
                      <Badge variant="secondary">대기</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
