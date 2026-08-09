import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { getPaymentProof, uploadPaymentProof } from "@/lib/services/paymentProofService";
import { ValidationError } from "@/lib/errors";

/** 관리자(GET) — 결제 증빙 이미지 조회(data URL, requirements.md 26번). 이미지 본문은 이 라우트에서만 내려간다. */
export const GET = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;
    const proof = await getPaymentProof(id);
    return jsonOk(proof);
  }
);

/** 관리자(POST) — 결제 증빙 대리 업로드(전화번호 검증 없음, requirements.md 26.3번). */
export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    await verifySessionFromRequest(req);
    const { id } = await context.params;

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      throw new ValidationError("multipart/form-data 요청이 필요합니다.");
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("file이 필요합니다.");
    }

    const result = await uploadPaymentProof(id, file, "ADMIN");
    return jsonOk(result);
  }
);
