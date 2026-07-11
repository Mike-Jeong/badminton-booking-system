/**
 * 공통 에러 클래스 (architecture.md 8장)
 * AppError를 베이스로 최소한의 하위 클래스만 둔다.
 */

export class AppError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** 400 — 입력값 오류(예: 슬롯 합 불일치) */
export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message, 400);
    this.name = "ValidationError";
  }
}

/** 401 — 로그인 실패/세션 무효 */
export class AdminAuthError extends AppError {
  constructor(message: string = "인증이 필요합니다.") {
    super("ADMIN_AUTH_ERROR", message, 401);
    this.name = "AdminAuthError";
  }
}

/** 404 — 예약일/예약/멤버 없음 */
export class NotFoundError extends AppError {
  constructor(message: string = "대상을 찾을 수 없습니다.") {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

/** 409 — 중복 예약, 슬롯 초과로 승인 불가, 전화번호 불일치로 취소 거부 등 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
    this.name = "ConflictError";
  }
}
