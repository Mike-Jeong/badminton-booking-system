import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AttendanceBadge } from "@/components/admin/AttendanceBadge";

export interface CheckInRosterBooking {
  id: string;
  name: string;
  phone: string;
  checkedInAt: string | Date | null;
  checkedOutAt: string | Date | null;
}

/**
 * 체크인 스캔 화면의 실시간 명단(CONFIRMED 예약만, decisions.md D-27).
 * 스캔 성공 시 CheckInScanner가 router.refresh()를 호출해 이 목록도 함께 갱신된다.
 */
export function CheckInRoster({ bookings }: { bookings: CheckInRosterBooking[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>확정 예약자 명단 ({bookings.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>전화번호</TableHead>
              <TableHead>출석</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  확정된 예약자가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.phone}</TableCell>
                <TableCell>
                  <AttendanceBadge checkedInAt={b.checkedInAt} checkedOutAt={b.checkedOutAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
