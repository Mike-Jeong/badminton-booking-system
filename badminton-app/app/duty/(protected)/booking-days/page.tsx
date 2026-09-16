import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireActiveDutyPerson } from "@/lib/services/dutyAuthService";
import { listBookingDaysForDuty } from "@/lib/services/dutyBookingDayService";
import { DutyAuthError } from "@/lib/errors";
import {
  formatDateOnlyInTimeZone,
  getDayOfWeekLabelKo,
  getTodayDateOnlyInTimeZone,
} from "@/lib/timezone";
import { DutyBookingDayListView } from "@/components/duty/DutyBookingDayListView";

export const dynamic = "force-dynamic";

/**
 * 듀티 담당자용 예약일 목록 화면(requirements.md 28.5번).
 * 레이아웃에서 이미 requireActiveDutyPerson을 거치지만, 여기서도 dutyPersonId를 얻기 위해
 * 다시 호출한다(서비스 로직 호출 전 재검증, decisions.md D-38).
 */
export default async function DutyBookingDaysPage() {
  const cookieStore = await cookies();

  let dutyPerson;
  try {
    dutyPerson = await requireActiveDutyPerson({ cookies: cookieStore });
  } catch (err) {
    if (err instanceof DutyAuthError) {
      redirect("/duty/login");
    }
    throw err;
  }

  const bookingDays = await listBookingDaysForDuty(dutyPerson.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">내 듀티 예약일</h1>
        <p className="text-sm text-muted-foreground">
          나에게 배정된 예약일만 표시됩니다. 기본으로 오늘 이후 일정만 보이며, 필터를 초기화하거나
          시작 날짜를 지우면 지난 일정도 볼 수 있습니다.
        </p>
      </div>

      <DutyBookingDayListView
        today={getTodayDateOnlyInTimeZone()}
        bookingDays={bookingDays.map((bd) => ({
          id: bd.id,
          date: formatDateOnlyInTimeZone(bd.date),
          dayOfWeekLabel: getDayOfWeekLabelKo(bd.dayOfWeek),
          label: bd.label,
          startTime: bd.startTime,
          endTime: bd.endTime,
          location: bd.location,
          totalSlots: bd.totalSlots,
          annualSlots: bd.annualSlots,
          casualSlots: bd.casualSlots,
          slotMode: bd.slotMode,
          isOpen: bd.isOpen,
        }))}
      />
    </div>
  );
}
