/**
 * 크론 라우트(/api/cron/club-days) 인증 (architecture.md 5-1장, decisions.md D-27)
 * Vercel Cron이 자동으로 실어 보내는 `Authorization: Bearer {CRON_SECRET}` 헤더를 검증한다.
 * 이 라우트는 /api/admin/* 미들웨어 보호 대상이 아니므로, 관리자 세션 대신 이 검증만 거친다.
 */

import { AdminAuthError } from "@/lib/errors";

/**
 * 요청의 authorization 헤더가 `Bearer ${CRON_SECRET}`와 일치하는지 검증한다.
 * - CRON_SECRET 환경변수가 설정되어 있지 않으면 설정 누락을 조용히 통과시키지 않고 즉시 에러.
 * - 헤더가 없거나 값이 다르면 AdminAuthError(401)를 던진다(새 에러 클래스를 추가하지 않고
 *   기존 AdminAuthError를 재사용한다, architecture.md 8장 원칙).
 */
export function assertCronSecret(req: { headers: { get(name: string): string | null } }): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new Error("CRON_SECRET 환경변수가 설정되지 않았습니다.");
  }

  const authorization = req.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    throw new AdminAuthError("크론 인증에 실패했습니다.");
  }
}
