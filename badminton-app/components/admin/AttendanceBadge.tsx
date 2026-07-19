import { Badge } from "@/components/ui/badge";

function formatCheckInTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** CONFIRMED 예약의 입장/퇴장 상태 배지(decisions.md D-27). AdminBookingsPanel, CheckInRoster에서 공유. */
export function AttendanceBadge({
  checkedInAt,
  checkedOutAt,
}: {
  checkedInAt: string | Date | null;
  checkedOutAt: string | Date | null;
}) {
  if (checkedOutAt) {
    return <Badge variant="secondary">퇴장 {formatCheckInTime(checkedOutAt)}</Badge>;
  }
  if (checkedInAt) {
    return <Badge>입장 {formatCheckInTime(checkedInAt)}</Badge>;
  }
  return <Badge variant="secondary">미입장</Badge>;
}
