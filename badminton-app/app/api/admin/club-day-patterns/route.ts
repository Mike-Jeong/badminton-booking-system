import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { createClubDayPattern, listClubDayPatterns } from "@/lib/services/clubDayPatternService";
import { ValidationError } from "@/lib/errors";

/** 관리자(GET) — 클럽데이 패턴 목록(삭제되지 않은 것만, decisions.md D-29). */
export const GET = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);
  const patterns = await listClubDayPatterns();
  return jsonOk(patterns);
});

/** 관리자(POST) — 클럽데이 패턴 등록(requirements.md 25.2번). */
export const POST = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.dayOfWeek !== "number" ||
    typeof body.startTime !== "string" ||
    typeof body.endTime !== "string" ||
    typeof body.location !== "string" ||
    typeof body.dutyPerson !== "string" ||
    typeof body.totalSlots !== "number" ||
    typeof body.slotMode !== "string"
  ) {
    throw new ValidationError(
      "dayOfWeek, startTime, endTime, location, dutyPerson, totalSlots, slotMode가 필요합니다."
    );
  }

  const pattern = await createClubDayPattern({
    name: body.name ?? null,
    dayOfWeek: body.dayOfWeek,
    label: body.label ?? null,
    startTime: body.startTime,
    endTime: body.endTime,
    location: body.location,
    dutyPerson: body.dutyPerson,
    totalSlots: body.totalSlots,
    annualSlots: body.annualSlots,
    casualSlots: body.casualSlots,
    slotMode: body.slotMode,
    autoAssignMonthlyMembers: body.autoAssignMonthlyMembers,
    isActive: body.isActive,
  });
  return jsonOk(pattern, 201);
});
