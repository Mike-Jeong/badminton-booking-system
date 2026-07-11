/**
 * 전화번호 저장 방식 (확정, decisions.md D-10 / requirements.md 17·21번)
 * 전화번호는 DB에 평문으로 저장하지 않는다.
 * - hashPhone: 결정론적 HMAC-SHA256. 조회/중복확인/일치판정(멤버 판별, 취소 본인확인)에 사용.
 * - encryptPhone/decryptPhone: AES-256-GCM. 관리자가 실제 번호를 열람해야 할 때만 사용.
 *
 * 마스터 키(PII_SECRET_KEY)에서 HKDF-SHA256으로 용도별 서브키를 분리 파생한다
 * (해시용 키와 암호화용 키를 같은 키로 재사용하지 않기 위함).
 *
 * Node.js 런타임 전제(Node crypto 모듈 사용). middleware/edge에서는 호출하지 않는다.
 */

import crypto from "node:crypto";

const MIN_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_AUTH_TAG_BYTES = 16;

function getMasterKey(): Buffer {
  const raw = process.env.PII_SECRET_KEY;
  if (!raw) {
    throw new Error(
      "PII_SECRET_KEY 환경변수가 설정되지 않았습니다. 전화번호 암호화/해시 계산에 반드시 필요합니다."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length < MIN_KEY_BYTES) {
    throw new Error(
      `PII_SECRET_KEY는 base64로 인코딩된 최소 ${MIN_KEY_BYTES}바이트 값이어야 합니다.`
    );
  }
  return key;
}

function deriveSubKey(info: string, length = 32): Buffer {
  const master = getMasterKey();
  const derived = crypto.hkdfSync(
    "sha256",
    master,
    Buffer.alloc(0),
    Buffer.from(info, "utf8"),
    length
  );
  return Buffer.from(derived);
}

let cachedHashKey: Buffer | null = null;
let cachedEncKey: Buffer | null = null;

function getHashKey(): Buffer {
  if (!cachedHashKey) {
    cachedHashKey = deriveSubKey("badminton-booking:phoneHash:v1");
  }
  return cachedHashKey;
}

function getEncKey(): Buffer {
  if (!cachedEncKey) {
    cachedEncKey = deriveSubKey("badminton-booking:phoneEncrypted:v1");
  }
  return cachedEncKey;
}

/**
 * 정규화된 전화번호(normalizePhone 결과)로부터 결정론적 HMAC-SHA256 해시를 계산한다.
 * 같은 입력은 항상 같은 출력이 나오므로 equality 조회(WHERE절)에 사용할 수 있다.
 */
export function hashPhone(normalizedPhone: string): string {
  return crypto
    .createHmac("sha256", getHashKey())
    .update(normalizedPhone, "utf8")
    .digest("hex");
}

/**
 * 정규화된 전화번호를 AES-256-GCM으로 암호화한다.
 * 매번 랜덤 IV를 사용하므로 같은 입력이라도 매번 다른 출력이 나온다(조회에는 사용 불가).
 * 반환값 포맷: base64(iv(12B) + authTag(16B) + ciphertext)
 */
export function encryptPhone(normalizedPhone: string): string {
  const iv = crypto.randomBytes(GCM_IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(normalizedPhone, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * encryptPhone으로 암호화된 값을 복원한다. 관리자 열람용 GET 라우트에서만 호출한다.
 */
export function decryptPhone(phoneEncrypted: string): string {
  const raw = Buffer.from(phoneEncrypted, "base64");
  if (raw.length < GCM_IV_BYTES + GCM_AUTH_TAG_BYTES) {
    throw new Error("phoneEncrypted 값의 형식이 올바르지 않습니다.");
  }
  const iv = raw.subarray(0, GCM_IV_BYTES);
  const authTag = raw.subarray(GCM_IV_BYTES, GCM_IV_BYTES + GCM_AUTH_TAG_BYTES);
  const encrypted = raw.subarray(GCM_IV_BYTES + GCM_AUTH_TAG_BYTES);

  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
