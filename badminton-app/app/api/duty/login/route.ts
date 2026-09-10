import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { login } from "@/lib/services/dutyAuthService";
import { DUTY_SESSION_COOKIE_NAME, DUTY_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/dutySession";
import { ValidationError } from "@/lib/errors";

/**
 * 듀티 담당자 로그인(requirements.md 28.4번, decisions.md D-38).
 * 관리자 세션 쿠키와 완전히 분리된 duty_session 쿠키를 발급한다(같은 브라우저에서 관리자와
 * 듀티 계정에 동시에 로그인해 있을 수 있다).
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.password !== "string") {
    throw new ValidationError("name과 password가 필요합니다.");
  }

  const cookieValue = await login(body.name, body.password);

  const res = jsonOk({ ok: true });
  res.cookies.set(DUTY_SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUTY_SESSION_MAX_AGE_SECONDS,
  });
  return res;
});
