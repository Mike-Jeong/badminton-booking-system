import Link from "next/link";
import { listBookingDays } from "@/lib/services/bookingDayService";
import { formatDateOnlyInTimeZone, getDayOfWeekLabelKo } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// 공개 예약일 목록. isOpen=true인 예약일만 노출한다(requirements.md 3번, architecture.md 1장).
export default async function PublicBookingDaysPage() {
  const bookingDays = await listBookingDays({ isOpen: true });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">예약 가능한 날짜</h2>
        <p className="text-sm text-muted-foreground">
          날짜를 선택해 이름과 전화번호로 예약을 신청하세요.
        </p>
      </div>

      {bookingDays.length === 0 && (
        <p className="text-muted-foreground">현재 공개된 예약일이 없습니다.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bookingDays.map((bd) => (
          <Link key={bd.id} href={`/booking-days/${bd.id}`}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>
                    {formatDateOnlyInTimeZone(bd.date)} ({getDayOfWeekLabelKo(bd.dayOfWeek)})
                  </span>
                  {bd.label && <Badge variant="secondary">{bd.label}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">시간</span> {bd.startTime} ~ {bd.endTime}
                </p>
                <p>
                  <span className="text-muted-foreground">장소</span> {bd.location}
                </p>
                <p>
                  <span className="text-muted-foreground">듀티</span> {bd.dutyPerson}
                </p>
                <p>
                  <span className="text-muted-foreground">슬롯</span>{" "}
                  {bd.slotMode === "SEPARATED"
                    ? `연 ${bd.annualSlots} + 캐 ${bd.casualSlots} = ${bd.totalSlots}`
                    : `${bd.totalSlots}명`}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
