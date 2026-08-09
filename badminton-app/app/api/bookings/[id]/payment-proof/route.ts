import { NextRequest } from "next/server";
import { withApiHandler, jsonOk, type RouteContext } from "@/lib/http";
import { uploadPaymentProof } from "@/lib/services/paymentProofService";
import { ValidationError } from "@/lib/errors";

/**
 * 공개(POST) — 결제 증빙 셀프 업로드(requirements.md 26.3번).
 * multipart/form-data: file, phone. phoneHash 검증을 거친다(취소와 동일한 방식).
 */
export const POST = withApiHandler<{ id: string }>(
  async (req: NextRequest, context: RouteContext<{ id: string }>) => {
    const { id } = await context.params;
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      throw new ValidationError("multipart/form-data 요청이 필요합니다.");
    }

    const file = formData.get("file");
    const phone = formData.get("phone");
    if (!(file instanceof File)) {
      throw new ValidationError("file이 필요합니다.");
    }
    if (typeof phone !== "string" || !phone) {
      throw new ValidationError("phone이 필요합니다.");
    }

    const result = await uploadPaymentProof(id, file, "SELF", phone);
    return jsonOk(result);
  }
);
