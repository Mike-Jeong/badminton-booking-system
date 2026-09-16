import { withApiHandler, jsonOk } from "@/lib/http";
import { logout } from "@/lib/services/dutyAuthService";
import { DUTY_SESSION_COOKIE_NAME } from "@/lib/auth/dutySession";

export const POST = withApiHandler(async () => {
  logout();

  const res = jsonOk({ ok: true });
  res.cookies.set(DUTY_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
});
