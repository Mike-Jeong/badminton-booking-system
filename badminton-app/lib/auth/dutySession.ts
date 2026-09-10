/**
 * 듀티 담당자 세션 쿠키 서명/검증 (architecture.md 5-2장, requirements.md 28.4번, decisions.md D-38)
 * - payload: { role: "duty", dutyPersonId, sessionVersion, iat, exp }
 *   (exp = iat + 24h, 관리자 세션과 동일한 만료)
 * - 서명: DUTY_SESSION_SECRET을 키로 HMAC-SHA256
 * - 쿠키 값 형식: base64url(payload JSON) + "." + base64url(signature)
 * - 관리자 세션(lib/auth/session.ts)과 완전히 분리된 별도 쿠키(duty_session)를 쓰며, 서명 방식만
 *   동일한 패턴을 재사용한다. Web Crypto API(crypto.subtle)만 사용해 Edge Runtime(middleware.ts)과
 *   Node 런타임(route handler / server component) 양쪽에서 동일 코드로 동작한다.
 * - 이 파일은 "세션이 유효한가"까지만 답한다. "그 계정이 지금도 활성 상태인가"(isActive)와
 *   "발급 이후 비밀번호가 바뀌지 않았는가"(sessionVersion)는 DB 조회가 필요하므로
 *   DutyAuthService.requireActiveDutyPerson이 담당한다(D-38).
 */

export interface DutySessionPayload {
  role: "duty";
  dutyPersonId: string;
  /**
   * 로그인 시점의 DutyPerson.sessionVersion(D-38 개정 2026-09-10).
   * 관리자가 비밀번호를 바꾸면 DB 쪽 값이 증가해 이 값과 어긋나고, requireActiveDutyPerson이
   * 그 불일치를 근거로 세션을 무효화한다. 여기(서명/만료 검증)에서는 값을 대조하지 않는다.
   */
  sessionVersion: number;
  iat: number;
  exp: number;
}

export const DUTY_SESSION_COOKIE_NAME = "duty_session";
export const DUTY_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24시간

function getSecret(): string {
  const secret = process.env.DUTY_SESSION_SECRET;
  if (!secret) {
    throw new Error("DUTY_SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = getSecret();
  const keyData = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** 로그인 성공 시 새 듀티 세션 쿠키 값을 생성한다. */
export async function createDutySessionCookieValue(input: {
  dutyPersonId: string;
  /** 로그인 시점에 DB에서 읽은 DutyPerson.sessionVersion. */
  sessionVersion: number;
}): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const payload: DutySessionPayload = {
    role: "duty",
    dutyPersonId: input.dutyPersonId,
    sessionVersion: input.sessionVersion,
    iat,
    exp: iat + DUTY_SESSION_MAX_AGE_SECONDS,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadB64 = base64UrlEncode(payloadBytes);

  const key = await getHmacKey();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, payloadBytes);
  const signatureB64 = base64UrlEncode(new Uint8Array(signatureBuffer));

  return `${payloadB64}.${signatureB64}`;
}

/**
 * 쿠키 값을 검증한다. 서명이 올바르지 않거나 만료되었으면 null을 반환한다.
 * (예외를 던지지 않음 — middleware/route handler 양쪽에서 null 체크로 분기하기 위함)
 */
export async function verifyDutySessionCookieValue(
  cookieValue: string | undefined | null
): Promise<DutySessionPayload | null> {
  if (!cookieValue) return null;

  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signatureB64] = parts;

  let payloadBytes: Uint8Array<ArrayBuffer>;
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    payloadBytes = base64UrlDecode(payloadB64);
    signatureBytes = base64UrlDecode(signatureB64);
  } catch {
    return null;
  }

  let key: CryptoKey;
  try {
    key = await getHmacKey();
  } catch {
    return null;
  }

  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    payloadBytes
  );
  if (!isValid) return null;

  let payload: DutySessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }

  if (payload.role !== "duty") return null;
  if (typeof payload.dutyPersonId !== "string" || !payload.dutyPersonId) return null;
  if (typeof payload.exp !== "number") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
