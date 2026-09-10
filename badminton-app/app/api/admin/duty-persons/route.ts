import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { createDutyPerson, listDutyPersons } from "@/lib/services/dutyPersonService";
import { ValidationError } from "@/lib/errors";

/**
 * 관리자(GET) — 듀티 담당자 계정 목록(활성+비활성 전체, requirements.md 28.2번).
 * activeOnly=true 쿼리로 활성 계정만 받을 수 있다(예약일/패턴 폼의 드롭다운용).
 * passwordHash는 응답에 포함하지 않는다.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);
  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";
  const dutyPersons = await listDutyPersons({ activeOnly });
  return jsonOk(
    dutyPersons.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  );
});

/** 관리자(POST) — 듀티 담당자 계정 등록(이름+비밀번호, requirements.md 28.2번). */
export const POST = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.password !== "string") {
    throw new ValidationError("name과 password가 필요합니다.");
  }

  const created = await createDutyPerson({ name: body.name, password: body.password });
  return jsonOk(
    { id: created.id, name: created.name, isActive: created.isActive },
    201
  );
});
