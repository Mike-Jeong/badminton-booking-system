/**
 * Route handler 공통 wrapper (architecture.md 8장)
 * 성공: { data: ... }
 * 실패: { error: { code, message } }
 */

import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./errors";

export type RouteContext<TParams extends Record<string, string> = Record<string, string>> = {
  params: Promise<TParams>;
};

type RouteHandler<TParams extends Record<string, string> = Record<string, string>> = (
  req: NextRequest,
  context: RouteContext<TParams>
) => Promise<NextResponse> | NextResponse;

export function withApiHandler<TParams extends Record<string, string> = Record<string, string>>(
  handler: RouteHandler<TParams>
) {
  return async (req: NextRequest, context: RouteContext<TParams>) => {
    try {
      return await handler(req, context);
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: err.httpStatus }
        );
      }
      console.error("[unhandled_error]", err);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
        { status: 500 }
      );
    }
  };
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
