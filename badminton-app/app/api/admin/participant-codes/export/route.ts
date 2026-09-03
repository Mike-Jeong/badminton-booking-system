import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import {
  listParticipantCodesForExport,
  recordParticipantCodeExport,
} from "@/lib/services/participantCodeService";
import { getTodayDateOnlyInTimeZone } from "@/lib/timezone";

/** RFC 4180 기준 최소 이스케이프: 구분자/따옴표/개행이 포함된 값만 따옴표로 감싼다. */
function toCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 관리자(GET) — 참여자 코드 CSV 다운로드(requirements.md 27.5.1번, decisions.md D-34).
 *
 * 이 프로젝트에서 유일하게 withApiHandler의 { data } JSON 포맷을 따르지 않는 라우트다
 * (파일 다운로드이므로 text/csv + Content-Disposition으로 직접 응답, architecture.md 4장).
 * 에러 시에는 withApiHandler가 평소대로 JSON 에러 응답을 만든다.
 *
 * 처리 순서: 조회(excludedFromExport=false만) → CSV 생성 → 내보내기 이력 기록 → 응답.
 * 이력은 실제로 CSV를 만든 이 경로에서만 기록한다(화면 조회는 기록하지 않음, D-34 개정 2).
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);

  const rows = await listParticipantCodesForExport();

  const lines = [
    ["코드", "이름", "전화번호"].join(","),
    ...rows.map((row) => [row.code, row.name, row.phone].map(toCsvField).join(",")),
  ];
  // UTF-8 BOM: 한글이 포함된 CSV를 Excel에서 열었을 때 깨지지 않도록 한다.
  const csv = `﻿${lines.join("\r\n")}\r\n`;

  await recordParticipantCodeExport(rows.length);

  const fileDate = getTodayDateOnlyInTimeZone().replace(/-/g, "");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participant-codes-${fileDate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
