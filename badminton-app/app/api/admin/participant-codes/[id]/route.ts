import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { setParticipantCodeExclusion, deleteParticipantCode } from "@/lib/services/participantCodeService";

/**
 * 관리자(PATCH) — 내보내기 제외 토글 전용({ excludedFromExport }, requirements.md 27.5.2번).
 * ParticipantCode는 예약 생성 시 시스템이 자동으로만 채우는 파생 데이터이므로 code/name 등
 * 다른 필드를 수정하는 API는 두지 않는다(decisions.md D-34 개정 1).
 */
export const PATCH = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body.excludedFromExport !== "boolean") {
      throw new ValidationError("excludedFromExport(boolean)가 필요합니다.");
    }
    const updated = await setParticipantCodeExclusion(id, body.excludedFromExport);
    return jsonOk(updated);
  }
);

/**
 * 관리자(DELETE) — 참여자 코드 완전 삭제(requirements.md 27.5.4번). 잘못 등록되어 다시 쓰이지
 * 않을 신원을 정리하는 용도다. 제외 토글과 달리 되돌릴 수 없다(같은 신원이 다시 예약하면 새
 * 코드가 새로 발급될 뿐, 삭제 전 코드가 복구되지는 않는다).
 */
export const DELETE = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    await deleteParticipantCode(id);
    return jsonOk({ id });
  }
);
