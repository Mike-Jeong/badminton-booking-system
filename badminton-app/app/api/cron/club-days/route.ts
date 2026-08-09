import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { assertCronSecret } from "@/lib/auth/cronAuth";
import { generateUpcomingClubDays } from "@/lib/services/clubDayGenerationService";

/**
 * Vercel Cron 전용(architecture.md 5-1장, deployment.md 1-1장, decisions.md D-27 개정).
 * /api/admin/* 미들웨어 보호 대상이 아니므로, 관리자 세션 대신 CRON_SECRET 헤더를 직접
 * 검증한다. 매일 뉴질랜드 기준 오전 10:30경 1회 호출되어, 실행일 기준 모레(+2일) 요일과
 * 일치하는 활성 클럽데이 패턴을 생성 + 공개한다.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  assertCronSecret(req);
  const results = await generateUpcomingClubDays();
  return jsonOk(results);
});
