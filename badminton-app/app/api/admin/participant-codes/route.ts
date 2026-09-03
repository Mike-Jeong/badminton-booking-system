import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import {
  listParticipantCodesForAdmin,
  countParticipantCodes,
  listParticipantCodeExportLogs,
} from "@/lib/services/participantCodeService";

/**
 * 관리자(GET) — 참여자 코드 목록(제외 설정 포함 전체) + 총 발급 건수 + 최근 내보내기 이력
 * (requirements.md 27.5번). 관리자 화면(/admin/participant-codes)은 Server Component가 서비스
 * 함수를 직접 호출하며, 이 라우트는 REST 표면의 일관성을 위해 함께 제공한다(architecture.md 4장).
 * 화면 조회만으로는 내보내기 이력을 기록하지 않는다(decisions.md D-34 개정 2).
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);
  const [codes, totalCount, exportLogs] = await Promise.all([
    listParticipantCodesForAdmin(),
    countParticipantCodes(),
    listParticipantCodeExportLogs(),
  ]);
  return jsonOk({ codes, totalCount, exportLogs });
});
