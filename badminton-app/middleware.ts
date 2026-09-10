/**
 * /admin/:path*  (단 /admin/login 제외)
 * /api/admin/:path* (단 /api/admin/login 제외)
 * /duty/:path* (단 /duty/login 제외)
 * /api/duty/:path* (단 /api/duty/login 제외)
 * 보호. 실패 시 페이지는 각 로그인 화면으로 리다이렉트, API는 401 JSON. (architecture.md 5장)
 *
 * 듀티 세션은 관리자 세션과 완전히 분리된 별도 쿠키를 쓰며, 여기서는 서명/만료만 검증한다
 * (1차 방어선). DutyPerson.isActive 재검증(2차·최종 방어선)은 Node 런타임 계층
 * (/duty/(protected)/layout.tsx, /api/duty/** 라우트 핸들러)의 requireActiveDutyPerson이
 * 담당한다 — lib/db/prisma.ts가 Node 런타임 전제라 Edge에서 DB를 조회할 수 없기 때문
 * (decisions.md D-38).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionCookieValue, ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { verifyDutySessionCookieValue, DUTY_SESSION_COOKIE_NAME } from "@/lib/auth/dutySession";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/duty/:path*", "/api/duty/:path*"],
};

function unauthorized(req: NextRequest, code: string, loginPath: string) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code, message: "인증이 필요합니다." } },
      { status: 401 }
    );
  }
  return NextResponse.redirect(new URL(loginPath, req.url));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isDutyRoute = pathname.startsWith("/duty") || pathname.startsWith("/api/duty");

  if (isDutyRoute) {
    if (pathname === "/duty/login" || pathname === "/api/duty/login") {
      return NextResponse.next();
    }
    const cookieValue = req.cookies.get(DUTY_SESSION_COOKIE_NAME)?.value;
    const session = await verifyDutySessionCookieValue(cookieValue);
    if (!session) {
      return unauthorized(req, "DUTY_AUTH_ERROR", "/duty/login");
    }
    return NextResponse.next();
  }

  const isPublicAdminRoute = pathname === "/admin/login" || pathname === "/api/admin/login";
  if (isPublicAdminRoute) {
    return NextResponse.next();
  }

  const cookieValue = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = await verifyAdminSessionCookieValue(cookieValue);

  if (!session) {
    return unauthorized(req, "ADMIN_AUTH_ERROR", "/admin/login");
  }

  return NextResponse.next();
}
