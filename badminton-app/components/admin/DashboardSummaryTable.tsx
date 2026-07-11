import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDayOfWeekLabelKo } from "@/lib/timezone";
import type { BookingDaySummary } from "@/lib/services/dashboardService";

/**
 * 예약일(세션)별 현황 테이블. 같은 날짜라도 라벨이 다르면 별도 행으로 구분된다
 * (requirements.md 3번 다중 세션 정책, qa-checklist.md §10).
 * "경고" 배지는 대기 인원(WAITING) 존재 여부다(decisions.md D-16).
 */
export function DashboardSummaryTable({
  sessions,
  emptyMessage,
}: {
  sessions: BookingDaySummary[];
  emptyMessage: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>날짜</TableHead>
          <TableHead>요일</TableHead>
          <TableHead>라벨</TableHead>
          <TableHead>장소</TableHead>
          <TableHead>확정</TableHead>
          <TableHead>대기</TableHead>
          <TableHead>취소</TableHead>
          <TableHead>슬롯 사용률</TableHead>
          <TableHead>경고</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.length === 0 && (
          <TableRow>
            <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
        {sessions.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <Link href={`/admin/booking-days/${s.id}`} className="underline-offset-2 hover:underline">
                {s.date}
              </Link>
            </TableCell>
            <TableCell>{getDayOfWeekLabelKo(s.dayOfWeek)}</TableCell>
            <TableCell>{s.label ?? "-"}</TableCell>
            <TableCell>{s.location}</TableCell>
            <TableCell>{s.confirmedCount}</TableCell>
            <TableCell>{s.waitingCount}</TableCell>
            <TableCell>{s.cancelledCount}</TableCell>
            <TableCell>
              {s.confirmedCount}/{s.totalSlots} ({Math.round(s.usageRate * 100)}%)
            </TableCell>
            <TableCell>
              {s.hasWaiting ? <Badge variant="destructive">대기 발생</Badge> : "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
