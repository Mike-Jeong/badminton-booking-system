import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { applyMonthlyMembersToMonth } from "@/lib/services/monthlyMemberService";
import { ValidationError } from "@/lib/errors";

/** 관리자(POST) — 특정 연/월(옵션 요일)의 모든 예약일에 월 멤버 자동 배정을 일괄 실행. */
export const POST = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.year !== "number" || typeof body.month !== "number") {
    throw new ValidationError("year, month가 필요합니다.");
  }

  const result = await applyMonthlyMembersToMonth(
    body.year,
    body.month,
    typeof body.dayOfWeek === "number" ? body.dayOfWeek : undefined
  );
  return jsonOk(result);
});
