"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeInTimeZone } from "@/lib/timezone";

export interface ParticipantCodeRow {
  id: string;
  code: string;
  name: string;
  phone: string;
  excludedFromExport: boolean;
}

export interface ParticipantCodeExportLogItem {
  id: string;
  exportedAt: string | Date;
  exportedCount: number;
}

/**
 * 참여자 코드 관리 화면(requirements.md 27.5번, decisions.md D-34).
 * 일반 수정(이름/전화번호 변경)은 없다 — ParticipantCode는 예약 생성 시 시스템이 자동으로만
 * 채우는 파생 데이터다. 쓰기 액션은 "내보내기 제외" 토글(opt-out)과 "삭제"(27.5.4번) 두 가지뿐.
 * 제외된 행도 목록에서 계속 보여줘야 관리자가 다시 포함시킬 수 있다(27.5.2번).
 */
export function ParticipantCodesPanel({
  codes,
  totalCount,
  exportLogs,
}: {
  codes: ParticipantCodeRow[];
  totalCount: number;
  exportLogs: ParticipantCodeExportLogItem[];
}) {
  const router = useRouter();
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const includedCount = codes.filter((c) => !c.excludedFromExport).length;
  const latestExport = exportLogs[0] ?? null;

  async function handleToggleExclusion(row: ParticipantCodeRow) {
    setRowLoadingId(row.id);
    setRowError((prev) => ({ ...prev, [row.id]: "" }));
    try {
      const res = await fetch(`/api/admin/participant-codes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludedFromExport: !row.excludedFromExport }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [row.id]: json?.error?.message ?? "처리에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [row.id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleDelete(row: ParticipantCodeRow) {
    if (!window.confirm(`"${row.name}" 코드를 완전히 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
    setRowLoadingId(row.id);
    setRowError((prev) => ({ ...prev, [row.id]: "" }));
    try {
      const res = await fetch(`/api/admin/participant-codes/${row.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [row.id]: json?.error?.message ?? "삭제에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [row.id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSV 내보내기</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            총 {totalCount}건 발급 · 내보내기 대상 {includedCount}건 (제외 {totalCount - includedCount}건)
          </p>
          <p className="text-sm text-muted-foreground">
            {latestExport
              ? `최근 내보내기: ${formatDateTimeInTimeZone(new Date(latestExport.exportedAt))} (${latestExport.exportedCount}명)`
              : "아직 내보낸 적이 없습니다."}
          </p>
          {exportLogs.length > 1 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {exportLogs.slice(1).map((log) => (
                <li key={log.id}>
                  {formatDateTimeInTimeZone(new Date(log.exportedAt))} ({log.exportedCount}명)
                </li>
              ))}
            </ul>
          )}
          {/*
            다운로드는 fetch가 아니라 브라우저 내비게이션으로 처리한다(Content-Disposition 헤더가
            그대로 동작). 내보내기 이력은 서버가 응답 시점에 기록하므로, 목록을 새로고침해야
            갱신된 이력이 보인다.
          */}
          <Button asChild>
            <a href="/api/admin/participant-codes/export" download>
              CSV 다운로드
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>참여자 코드 목록 ({codes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>코드</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>전화번호</TableHead>
                <TableHead>내보내기</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    발급된 참여자 코드가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {codes.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>
                    <Badge variant={row.excludedFromExport ? "secondary" : "default"}>
                      {row.excludedFromExport ? "제외됨" : "포함"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Button
                        size="sm"
                        variant={row.excludedFromExport ? "secondary" : "outline"}
                        disabled={rowLoadingId === row.id}
                        onClick={() => handleToggleExclusion(row)}
                      >
                        {row.excludedFromExport ? "내보내기 포함" : "내보내기 제외"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={rowLoadingId === row.id}
                        onClick={() => handleDelete(row)}
                      >
                        삭제
                      </Button>
                      {rowError[row.id] && (
                        <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                          {rowError[row.id]}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
