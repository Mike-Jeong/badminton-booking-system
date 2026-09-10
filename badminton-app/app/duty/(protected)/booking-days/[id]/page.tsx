import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireActiveDutyPerson } from "@/lib/services/dutyAuthService";
import { getBookingDayForDuty } from "@/lib/services/dutyBookingDayService";
import { DutyAuthError, NotFoundError } from "@/lib/errors";
import { formatDateOnlyInTimeZone, getDayOfWeekLabelKo } from "@/lib/timezone";
import { DutyBookingDayDetailView } from "@/components/duty/DutyBookingDayDetailView";

export const dynamic = "force-dynamic";

/**
 * 듀티 담당자용 예약일 상세 화면(requirements.md 28.5번, 읽기 전용).
 * 자신에게 배정되지 않은 예약일(또는 없는 id)은 서비스가 NotFoundError를 던지고 404로 처리한다
 * (decisions.md D-38 — 403 대신 404로 존재 여부 자체를 감춘다).
 */
export default async function DutyBookingDayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  let result;
  try {
    result = await getBookingDayForDuty(id, dutyPerson.id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  const { bookingDay, bookings } = result;

  return (
    <DutyBookingDayDetailView
      bookingDay={{
        id: bookingDay.id,
        date: formatDateOnlyInTimeZone(bookingDay.date),
        dayOfWeekLabel: getDayOfWeekLabelKo(bookingDay.dayOfWeek),
        label: bookingDay.label,
        startTime: bookingDay.startTime,
        endTime: bookingDay.endTime,
        location: bookingDay.location,
        totalSlots: bookingDay.totalSlots,
        annualSlots: bookingDay.annualSlots,
        casualSlots: bookingDay.casualSlots,
        slotMode: bookingDay.slotMode,
        isOpen: bookingDay.isOpen,
      }}
      participants={bookings.map((b) => ({ id: b.id, name: b.name, status: b.status }))}
    />
  );
}
