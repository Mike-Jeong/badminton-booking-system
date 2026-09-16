/**
 * DutyAuthService (architecture.md 2장/5-2장, requirements.md 28.4번, decisions.md D-38)
 * - login(name, password): DutyPerson 조회 + scrypt 해시 검증 후 듀티 세션 쿠키 값 발급
 * - verifyDutySessionFromRequest(req): 서명/만료만 검증(DB 조회 없음, middleware용 1차 방어선)
 * - requireActiveDutyPerson(req): 서명 검증 + 매 호출마다 DB에서 isActive/sessionVersion
 *   재조회(2차·최종 방어선)
 * - logout(): 쿠키 무효화(실제 Set-Cookie는 route handler에서 처리, adminAuthService와 동일)
 *
 * 관리자 세션(adminAuthService)은 DB 조회가 전혀 없는 완전 무상태 방식이지만, 듀티 세션은
 * "관리자가 방금 비활성화한 계정이 이미 발급된 세션으로 계속 접근하는 것"을 막아야 하므로
 * requireActiveDutyPerson이 매 요청 DB를 조회한다(decisions.md D-38).
 */

import { prisma } from "@/lib/db/prisma";
import {
  createDutySessionCookieValue,
  verifyDutySessionCookieValue,
  DUTY_SESSION_COOKIE_NAME,
  type DutySessionPayload,
} from "@/lib/auth/dutySession";
import { DutyAuthError } from "@/lib/errors";
import { verifyDutyPassword } from "@/lib/security/dutyPasswordCrypto";

/** NextRequest / next/headers의 cookies() 둘 다 만족하는 최소 인터페이스. */
export interface CookieCarrier {
  cookies: { get(name: string): { value: string } | undefined };
}

export interface ActiveDutyPerson {
  id: string;
  name: string;
}

/**
 * name + password로 로그인한다. 계정이 없거나, 비활성(isActive=false)이거나, 비밀번호가 틀리면
 * 모두 동일한 DutyAuthError를 던진다(어느 이름이 존재하는지 노출하지 않기 위함).
 * 성공 시 세션 쿠키 값을 반환한다(실제 Set-Cookie는 route handler에서 처리).
 */
export async function login(name: string, password: string): Promise<string> {
  if (typeof name !== "string" || typeof password !== "string" || !name.trim() || !password) {
    throw new DutyAuthError("이름 또는 비밀번호가 올바르지 않습니다.");
  }

  const record = await prisma.dutyPerson.findUnique({ where: { name: name.trim() } });
  if (!record || !record.isActive) {
    throw new DutyAuthError("이름 또는 비밀번호가 올바르지 않습니다.");
  }
  if (!verifyDutyPassword(password, record.passwordHash)) {
    throw new DutyAuthError("이름 또는 비밀번호가 올바르지 않습니다.");
  }

  // 로그인 시점의 sessionVersion을 세션에 함께 담는다 — 이후 관리자가 비밀번호를 바꾸면
  // DB 값이 증가해 이 세션은 requireActiveDutyPerson에서 무효 처리된다(D-38 개정 2026-09-10).
  return createDutySessionCookieValue({
    dutyPersonId: record.id,
    sessionVersion: record.sessionVersion,
  });
}

/**
 * 요청의 듀티 세션 쿠키를 서명/만료만 검증한다(DB 조회 없음).
 * middleware(Edge Runtime)처럼 빠른 1차 검증만 필요한 지점에서 사용한다.
 * 유효하지 않으면 null을 반환한다.
 */
export async function verifyDutySessionFromRequest(
  req: CookieCarrier
): Promise<DutySessionPayload | null> {
  const cookieValue = req.cookies.get(DUTY_SESSION_COOKIE_NAME)?.value;
  return verifyDutySessionCookieValue(cookieValue);
}

/**
 * 이 서비스의 핵심 함수(decisions.md D-38). 세션 서명/만료 검증에 더해 **매 호출마다**
 * DutyPerson.isActive와 sessionVersion을 DB에서 다시 조회한다. 세션이 무효하거나, 계정이 없거나,
 * 비활성이거나, 발급 이후 비밀번호가 바뀐(sessionVersion 불일치) 경우 DutyAuthError(401)를 던진다.
 *
 * /duty/(protected)/layout.tsx와 /api/duty/** 라우트 핸들러 전체가 서비스 로직 호출 전에
 * 반드시 이 함수를 거쳐야 한다.
 */
export async function requireActiveDutyPerson(req: CookieCarrier): Promise<ActiveDutyPerson> {
  const payload = await verifyDutySessionFromRequest(req);
  if (!payload) {
    throw new DutyAuthError("세션이 유효하지 않습니다. 다시 로그인해주세요.");
  }

  const record = await prisma.dutyPerson.findUnique({
    where: { id: payload.dutyPersonId },
    select: { id: true, name: true, isActive: true, sessionVersion: true },
  });
  if (!record || !record.isActive) {
    throw new DutyAuthError("사용할 수 없는 계정입니다. 관리자에게 문의해주세요.");
  }

  // 비밀번호가 바뀌면 sessionVersion이 증가하므로, 발급 시점 값과 다르면 이미 낡은 세션이다
  // (이 기능 배포 전에 발급되어 payload에 필드가 아예 없는 세션도 여기서 함께 걸러진다).
  if (payload.sessionVersion !== record.sessionVersion) {
    throw new DutyAuthError("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
  }

  return { id: record.id, name: record.name };
}

/**
 * 로그아웃. DB 세션 테이블이 없으므로 서버 측에서 할 일은 없고,
 * 실제 쿠키 무효화(Set-Cookie maxAge=0)는 route handler가 응답에 담당한다.
 */
export function logout(): void {
  // no-op: DB 세션 테이블 없음. 쿠키 삭제는 route handler에서 처리(adminAuthService와 동일).
}
