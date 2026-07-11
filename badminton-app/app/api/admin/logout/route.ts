import { withApiHandler, jsonOk } from "@/lib/http";
import { logout } from "@/lib/services/adminAuthService";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const POST = withApiHandler(async () => {
  logout();

  const res = jsonOk({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
});
