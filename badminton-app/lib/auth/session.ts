/**
 * 관리자 세션 쿠키 서명/검증 (architecture.md 5장)
 * - payload: { role: "admin", iat, exp } (exp = iat + 24h)
 * - 서명: ADMIN_SESSION_SECRET을 키로 HMAC-SHA256
 * - 쿠키 값 형식: base64url(payload JSON) + "." + base64url(signature)
 * - Web Crypto API(crypto.subtle)만 사용해 Edge Runtime(middleware.ts)과
 *   Node 런타임(route handler) 양쪽에서 동일 코드로 동작한다.
 */

export interface AdminSessionPayload {
  role: "admin";
  iat: number;
  exp: number;
}

export const ADMIN_SESSION_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24시간

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET 환경변수가 설정되지 않았습니다.");
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

/** 로그인 성공 시 새 세션 쿠키 값을 생성한다. */
export async function createAdminSessionCookieValue(): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    role: "admin",
    iat,
    exp: iat + ADMIN_SESSION_MAX_AGE_SECONDS,
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
export async function verifyAdminSessionCookieValue(
  cookieValue: string | undefined | null
): Promise<AdminSessionPayload | null> {
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

  let payload: AdminSessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }

  if (payload.role !== "admin") return null;
  if (typeof payload.exp !== "number") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
