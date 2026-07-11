import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { updateAnnualMember, deactivateAnnualMember } from "@/lib/services/annualMemberService";

/** 관리자(PATCH) — 연 멤버 수정(이름/전화번호/메모/활성여부). */
export const PATCH = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const member = await updateAnnualMember(id, body);
    return jsonOk(member);
  }
);

/** 관리자(DELETE) — "삭제"는 실제로 isActive=false 처리(하드 삭제 없음, decisions.md D-07). */
export const DELETE = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const member = await deactivateAnnualMember(id);
    return jsonOk(member);
  }
);
