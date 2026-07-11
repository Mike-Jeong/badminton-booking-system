import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { createMonthlyMember, listMonthlyMembers } from "@/lib/services/monthlyMemberService";
import { ValidationError } from "@/lib/errors";

/** 관리자(GET) — 월 멤버 목록(연/월 필터, ?year=&month=). */
export const GET = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);
  const { searchParams } = req.nextUrl;
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const members = await listMonthlyMembers({
    year: year !== null ? Number(year) : undefined,
    month: month !== null ? Number(month) : undefined,
  });
  return jsonOk(members);
});

/** 관리자(POST) — 월 멤버 등록. */
export const POST = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.annualMemberId !== "string" ||
    typeof body.year !== "number" ||
    typeof body.month !== "number" ||
    typeof body.dayOfWeek !== "number"
  ) {
    throw new ValidationError("annualMemberId, year, month, dayOfWeek가 필요합니다.");
  }

  const member = await createMonthlyMember({
    annualMemberId: body.annualMemberId,
    year: body.year,
    month: body.month,
    dayOfWeek: body.dayOfWeek,
    memo: body.memo ?? null,
  });
  return jsonOk(member, 201);
});
