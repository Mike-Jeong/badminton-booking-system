import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { updateDutyPerson } from "@/lib/services/dutyPersonService";

/**
 * 관리자(PATCH) — 듀티 담당자 계정 수정(이름/비밀번호 변경, isActive 토글).
 * DELETE 라우트는 의도적으로 두지 않는다(하드 삭제 없음, decisions.md D-37) —
 * BookingDayDutyPerson/ClubDayPatternDutyPerson 조인 테이블(D-39)이 이 계정을 참조하기 때문이다.
 */
export const PATCH = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const updated = await updateDutyPerson(id, {
      name: body.name,
      password: body.password,
      isActive: body.isActive,
    });
    return jsonOk({ id: updated.id, name: updated.name, isActive: updated.isActive });
  }
);
