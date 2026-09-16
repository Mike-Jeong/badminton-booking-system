import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { requireActiveDutyPerson } from "@/lib/services/dutyAuthService";
import { getBookingDayForDuty } from "@/lib/services/dutyBookingDayService";

/**
 * 듀티(GET) — 예약일 상세(기본 정보 + 참여자 이름/상태만, requirements.md 28.5번).
 * 자신에게 배정되지 않은 id는 NotFoundError(404, decisions.md D-38).
 * 전화번호/결제확인/참여자 코드는 서비스가 애초에 select하지 않아 응답에 포함될 수 없다.
 */
export const GET = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    const dutyPerson = await requireActiveDutyPerson(req);
    const { id } = await context.params;
    const result = await getBookingDayForDuty(id, dutyPerson.id);
    return jsonOk(result);
  }
);
