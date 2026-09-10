/**
 * 듀티 담당자 비밀번호 해시 (architecture.md 6-1장, requirements.md 28.4번, decisions.md D-38)
 * - 관리자 비밀번호(환경변수 평문 단일 비밀번호, D-13)와 달리 듀티 계정은 여러 개이고 관리자 화면에서
 *   즉시 등록/변경되므로, 비밀번호를 DB에 평문으로 두지 않고 해시로 저장한다.
 * - Node 내장 crypto.scrypt만 사용한다(새 npm 의존성 없음 — lib/security/phoneCrypto.ts와 동일 원칙).
 * - 저장 형식: `${saltHex}:${hashHex}` (계정마다 무작위 salt).
 *
 * Node.js 런타임 전제(Node crypto 모듈 사용). middleware/edge에서는 호출하지 않는다.
 */

import crypto from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/** 비밀번호를 무작위 salt와 함께 scrypt로 파생해 "saltHex:hashHex" 문자열로 반환한다. */
export function hashDutyPassword(password: string): string {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("비밀번호가 비어 있습니다.");
  }
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(password, salt, KEY_BYTES);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/**
 * 저장된 "saltHex:hashHex"와 입력 비밀번호를 비교한다.
 * 타이밍 공격 방지를 위해 crypto.timingSafeEqual로 비교한다
 * (adminAuthService.ts의 timingSafeStringEqual과 같은 원칙).
 */
export function verifyDutyPassword(password: string, stored: string): boolean {
  if (typeof password !== "string" || typeof stored !== "string") return false;

  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = crypto.scryptSync(password, salt, expected.length);
  } catch {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
}
