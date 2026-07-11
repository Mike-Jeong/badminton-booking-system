import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { login } from "@/lib/services/adminAuthService";
import { ADMIN_SESSION_COOKIE_NAME, ADMIN_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.password !== "string") {
    throw new ValidationError("password가 필요합니다.");
  }

  const cookieValue = await login(body.password);

  const res = jsonOk({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return res;
});
