import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { setParticipantCodeExclusion } from "@/lib/services/participantCodeService";

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
