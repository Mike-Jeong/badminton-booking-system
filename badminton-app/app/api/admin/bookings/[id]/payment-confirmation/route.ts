import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { setPaymentConfirmation } from "@/lib/services/paymentProofService";
import { ValidationError } from "@/lib/errors";

/** 관리자(PATCH) — 결제 확인/확인취소(requirements.md 26.4번). 반려 없음, 상태 2가지뿐. */
export const PATCH = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body.confirmed !== "boolean") {
      throw new ValidationError("confirmed(boolean)가 필요합니다.");
    }

    const result = await setPaymentConfirmation(id, body.confirmed);
    return jsonOk(result);
  }
);
