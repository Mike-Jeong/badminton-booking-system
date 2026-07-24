import Link from "next/link";
import { listBookingDays } from "@/lib/services/bookingDayService";
import { formatDateOnlyInTimeZone, getDayOfWeekLabelKo } from "@/lib/timezone";
import { CreateBookingDayForm } from "@/components/admin/CreateBookingDayForm";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminBookingDaysPage() {
  const bookingDays = await listBookingDays();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">예약일 관리</h1>
        <p className="text-sm text-muted-foreground">
          예약 가능한 날짜(세션)를 생성하고 관리합니다.
        </p>
      </div>

      <CreateBookingDayForm />

      <Card>
        <CardHeader>
          <CardTitle>예약일 목록 ({bookingDays.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>요일</TableHead>
                <TableHead>라벨</TableHead>
                <TableHead>시간</TableHead>
                <TableHead>장소</TableHead>
                <TableHead>듀티</TableHead>
                <TableHead>슬롯</TableHead>
                <TableHead>정책</TableHead>
                <TableHead>공개</TableHead>
                <TableHead>구분</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookingDays.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    생성된 예약일이 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {bookingDays.map((bd) => (
                <TableRow key={bd.id}>
                  <TableCell>
                    <Link href={`/admin/booking-days/${bd.id}`} className="font-medium underline-offset-2 hover:underline">
                      {formatDateOnlyInTimeZone(bd.date)}
                    </Link>
                  </TableCell>
                  <TableCell>{getDayOfWeekLabelKo(bd.dayOfWeek)}</TableCell>
                  <TableCell>{bd.label ?? "-"}</TableCell>
                  <TableCell>
                    {bd.startTime} ~ {bd.endTime}
                  </TableCell>
                  <TableCell>{bd.location}</TableCell>
                  <TableCell>{bd.dutyPerson}</TableCell>
                  <TableCell>
                    {bd.slotMode === "SEPARATED"
                      ? `연 ${bd.annualSlots} + 캐 ${bd.casualSlots} = ${bd.totalSlots}`
                      : `${bd.totalSlots}`}
                  </TableCell>
                  <TableCell>{bd.slotMode === "SEPARATED" ? "분리" : "통합"}</TableCell>
                  <TableCell>
                    {bd.isOpen ? (
                      <Badge>공개</Badge>
                    ) : (
                      <Badge variant="secondary">비공개</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {bd.clubDayPatternId ? <Badge variant="outline">클럽데이</Badge> : "-"}
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
