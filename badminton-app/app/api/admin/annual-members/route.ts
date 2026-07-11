import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { createAnnualMember, listAnnualMembers } from "@/lib/services/annualMemberService";
import { ValidationError } from "@/lib/errors";

/** 관리자(GET) — 연 멤버 목록(전화번호 복호화 포함). */
export const GET = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);
  const members = await listAnnualMembers();
  return jsonOk(members);
});

/** 관리자(POST) — 연 멤버 등록. */
export const POST = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.phone !== "string") {
    throw new ValidationError("name, phone이 필요합니다.");
  }

  const member = await createAnnualMember({
    name: body.name,
    phone: body.phone,
    memo: body.memo ?? null,
  });
  return jsonOk(member, 201);
});
