/**
 * PrismaClient 싱글턴. Turso(libSQL)에 @prisma/adapter-libsql 드라이버 어댑터로 연결한다.
 * 로컬 개발 시에는 TURSO_DATABASE_URL=file:./dev.db 로 설정하면 libSQL 클라이언트가
 * 로컬 파일 URL도 지원하므로, 프로덕션(Turso 원격 URL)과 동일한 코드 경로를 그대로 사용한다.
 * (deployment.md 참고)
 *
 * 개발 모드 hot-reload 시 PrismaClient가 매 리로드마다 새로 생성되어 커넥션이 누적되는
 * 문제를 막기 위해 globalThis에 캐싱한다.
 */

import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

/**
 * 로컬 파일 SQLite("file:" + 상대경로)일 때, `prisma migrate dev`가 그 경로를
 * schema.prisma 파일 위치(=prisma/) 기준으로 해석하는 것과 동일한 결과가 나오도록
 * 절대경로로 변환한다. libsql 클라이언트는 상대경로를 process.cwd() 기준으로 해석하므로,
 * 변환 없이 그대로 넘기면 마이그레이션이 만든 DB 파일과 다른 파일을 보게 된다
 * (Next.js 실행 시 cwd는 프로젝트 루트이지 prisma/가 아님).
 */
function resolveLocalSqliteUrl(url: string): string {
  const prefix = "file:";
  if (!url.startsWith(prefix)) return url;
  const rawPath = url.slice(prefix.length);
  if (path.isAbsolute(rawPath) || rawPath.startsWith(":memory:")) return url;
  return prefix + path.join(process.cwd(), "prisma", rawPath);
}

function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.TURSO_DATABASE_URL;
  if (!rawUrl) {
    throw new Error(
      "TURSO_DATABASE_URL 환경변수가 설정되지 않았습니다. 로컬 개발 시 file:./dev.db 등을 사용하세요."
    );
  }
  const url = resolveLocalSqliteUrl(rawUrl);
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const adapter = new PrismaLibSQL({
    url,
    authToken,
  });

  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalThis.__prisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}
