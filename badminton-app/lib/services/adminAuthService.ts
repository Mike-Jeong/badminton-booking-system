/**
 * AdminAuthService (architecture.md 2장/5장, requirements.md 21번, decisions.md D-13)
 * - login(password): ADMIN_PASSWORD 환경변수와 crypto.timingSafeEqual로 비교 후 세션 쿠키 값 발급
 * - verifySession(cookieValue): 서명/만료 검증
 * - logout(): 쿠키 무효화(실제 Set-Cookie는 route handler에서 처리)
 */

import crypto from "node:crypto";
import {
  createAdminSessionCookieValue,
  verifyAdminSessionCookieValue,
  ADMIN_SESSION_COOKIE_NAME,
  type AdminSessionPayload,
} from "@/lib/auth/session";
import { AdminAuthError } from "@/lib/errors";

/**
 * 길이가 달라도 타이밍 정보가 새지 않도록, 두 버퍼를 동일한 길이로 맞춘 뒤
 * timingSafeEqual로 비교한다(길이 자체의 비교 결과는 별도로 함께 판정).
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  const maxLen = Math.max(aBuf.length, bBuf.length, 1);
  const aPadded = Buffer.alloc(maxLen);
  const bPadded = Buffer.alloc(maxLen);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);

  const contentEqual = crypto.timingSafeEqual(aPadded, bPadded);
  return contentEqual && aBuf.length === bBuf.length;
}

/**
 * 비밀번호를 검증하고, 성공 시 새 세션 쿠키 값을 반환한다.
 * 실패 시 AdminAuthError를 던진다.
 */
export async function login(password: string): Promise<string> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.");
  }

  if (typeof password !== "string" || !timingSafeStringEqual(password, expected)) {
    throw new AdminAuthError("비밀번호가 올바르지 않습니다.");
  }

  return createAdminSessionCookieValue();
}

/**
 * 쿠키 값을 검증한다. 유효하지 않으면 AdminAuthError를 던진다.
 */
export async function verifySession(
  cookieValue: string | undefined | null
): Promise<AdminSessionPayload> {
  const payload = await verifyAdminSessionCookieValue(cookieValue);
  if (!payload) {
    throw new AdminAuthError("세션이 유효하지 않습니다. 다시 로그인해주세요.");
  }
  return payload;
}

/**
 * Route handler에서 요청의 쿠키로부터 바로 세션을 검증하기 위한 편의 함수.
 * middleware가 이미 1차로 보호하지만, 미들웨어 우회 가능성에 대한 방어적 이중 체크로
 * route handler 내부에서도 재검증한다(architecture.md 5장).
 */
export async function verifySessionFromRequest(req: {
  cookies: { get(name: string): { value: string } | undefined };
}): Promise<AdminSessionPayload> {
  const cookieValue = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return verifySession(cookieValue);
}

/**
 * 로그아웃. DB 세션 테이블이 없으므로 서버 측에서 할 일은 없고,
 * 실제 쿠키 무효화(Set-Cookie maxAge=0)는 route handler가 응답에 담당한다.
 */
export function logout(): void {
  // no-op: DB 세션 테이블 없음(요구사항 확정사항). 쿠키 삭제는 route handler에서 처리.
}
