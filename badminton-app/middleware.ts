/**
 * /admin/:path*  (단 /admin/login 제외)
 * /api/admin/:path* (단 /api/admin/login 제외)
 * 보호. 실패 시 페이지는 /admin/login 리다이렉트, API는 401 JSON. (architecture.md 5장)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionCookieValue, ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicAdminRoute = pathname === "/admin/login" || pathname === "/api/admin/login";
  if (isPublicAdminRoute) {
    return NextResponse.next();
  }

  const cookieValue = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = await verifyAdminSessionCookieValue(cookieValue);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "ADMIN_AUTH_ERROR", message: "인증이 필요합니다." } },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
