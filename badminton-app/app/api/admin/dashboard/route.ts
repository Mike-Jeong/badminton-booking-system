import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { getTodaySummary, getSummaryByDateRange } from "@/lib/services/dashboardService";
import { addDaysToDateOnly } from "@/lib/timezone";

/**
 * 관리자(GET) — 대시보드 요약 데이터.
 * ?from=&to=(YYYY-MM-DD)로 날짜 범위를 지정할 수 있다. 기본값은 오늘~+30일(다가오는 한 달).
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);

  const today = await getTodaySummary();

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from") ?? today.date;
  const to = searchParams.get("to") ?? addDaysToDateOnly(today.date, 30);

  const range = await getSummaryByDateRange(from, to);

  return jsonOk({ today, range: { from, to, sessions: range } });
});
