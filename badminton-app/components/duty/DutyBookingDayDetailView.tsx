import Link from "next/link";
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

export interface DutyBookingDayDetail {
  id: string;
  /** "YYYY-MM-DD" (Pacific/Auckland 기준으로 서버에서 이미 변환된 값) */
  date: string;
  dayOfWeekLabel: string;
  label: string | null;
  startTime: string;
  endTime: string;
  location: string;
  totalSlots: number;
  annualSlots: number;
  casualSlots: number;
  slotMode: "SEPARATED" | "COMBINED";
  isOpen: boolean;
}

export interface DutyParticipant {
  id: string;
  name: string;
  status: "WAITING" | "CONFIRMED" | "CANCELLED";
}

const STATUS_LABEL: Record<DutyParticipant["status"], string> = {
  CONFIRMED: "확정",
  WAITING: "대기",
  CANCELLED: "취소",
};

/**
 * 듀티 담당자용 예약일 상세(requirements.md 28.5번). **순수 읽기 전용** — 수정/취소/결제확인 등
 * 어떤 액션 버튼도 두지 않는다. 참여자는 이름과 상태만 표시하며(전화번호/결제/참여자 코드는
 * 애초에 서버에서 조회하지 않는다), 취소된 예약은 관리자 화면과 동일하게 취소선으로 표시한다.
 */
export function DutyBookingDayDetailView({
  bookingDay,
  participants,
}: {
  bookingDay: DutyBookingDayDetail;
  participants: DutyParticipant[];
}) {
  const confirmedCount = participants.filter((p) => p.status === "CONFIRMED").length;
  const waitingCount = participants.filter((p) => p.status === "WAITING").length;
  const cancelledCount = participants.filter((p) => p.status === "CANCELLED").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/duty/booking-days" className="text-sm text-muted-foreground hover:underline">
            ← 내 듀티 예약일
          </Link>
          <h1 className="text-2xl font-bold">
            {bookingDay.date} ({bookingDay.dayOfWeekLabel})
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
          <div>
            <p className="text-muted-foreground">취소 인원</p>
            <p className="font-medium">{cancelledCount}명</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>참여자 명단 ({participants.length})</CardTitle>
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
              {participants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                    예약자가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {participants.map((p) => (
                <TableRow key={p.id}>
                  <TableCell
                    className={p.status === "CANCELLED" ? "line-through text-muted-foreground" : undefined}
                  >
                    {p.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "CONFIRMED" ? "default" : "secondary"}>
                      {STATUS_LABEL[p.status]}
                    </Badge>
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
