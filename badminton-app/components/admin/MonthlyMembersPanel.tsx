"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export interface MonthlyMemberRow {
  id: string;
  annualMemberId: string;
  annualMemberName: string;
  annualMemberActive: boolean;
  year: number;
  month: number;
  dayOfWeek: number;
  isActive: boolean;
  memo: string | null;
}

export interface AnnualMemberOption {
  id: string;
  name: string;
}

export function MonthlyMembersPanel({
  year,
  month,
  monthlyMembers,
  annualMembers,
}: {
  year: number;
  month: number;
  monthlyMembers: MonthlyMemberRow[];
  annualMembers: AnnualMemberOption[];
}) {
  const router = useRouter();

  const [filterYear, setFilterYear] = useState(String(year));
  const [filterMonth, setFilterMonth] = useState(String(month));

  const [createForm, setCreateForm] = useState({
    annualMemberId: annualMembers[0]?.id ?? "",
    year: String(year),
    month: String(month),
    dayOfWeek: "1",
    memo: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const [applyDayOfWeek, setApplyDayOfWeek] = useState<string>("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<{ createdCount: number; skippedCount: number } | null>(
    null
  );
  const [applyError, setApplyError] = useState<string | null>(null);

  function handleFilterSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(`/admin/monthly-members?year=${filterYear}&month=${filterMonth}`);
  }

  async function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/monthly-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualMemberId: createForm.annualMemberId,
          year: Number(createForm.year),
          month: Number(createForm.month),
          dayOfWeek: Number(createForm.dayOfWeek),
          memo: createForm.memo || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json?.error?.message ?? "등록에 실패했습니다.");
        return;
      }
      setCreateForm((prev) => ({ ...prev, memo: "" }));
      router.refresh();
    } catch {
      setCreateError("네트워크 오류가 발생했습니다.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleToggleActive(member: MonthlyMemberRow) {
    setRowLoadingId(member.id);
    setRowError((prev) => ({ ...prev, [member.id]: "" }));
    try {
      const res = member.isActive
        ? await fetch(`/api/admin/monthly-members/${member.id}`, { method: "DELETE" })
        : await fetch(`/api/admin/monthly-members/${member.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: true }),
          });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [member.id]: json?.error?.message ?? "처리에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [member.id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleApply() {
    setApplyLoading(true);
    setApplyError(null);
    setApplyResult(null);
    try {
      const res = await fetch("/api/admin/monthly-members/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          dayOfWeek: applyDayOfWeek === "" ? undefined : Number(applyDayOfWeek),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setApplyError(json?.error?.message ?? "자동 배정에 실패했습니다.");
        return;
      }
      setApplyResult(json.data);
      router.refresh();
    } catch {
      setApplyError("네트워크 오류가 발생했습니다.");
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>연/월 조회</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="filter-year">연도</Label>
              <Input
                id="filter-year"
                type="number"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-month">월</Label>
              <Input
                id="filter-month"
                type="number"
                min={1}
                max={12}
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-20"
              />
            </div>
            <Button type="submit" variant="outline">
              조회
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>월 멤버 등록</CardTitle>
        </CardHeader>
        <CardContent>
          {annualMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              먼저 연 멤버 관리 화면에서 활성 연 멤버를 등록해주세요.
            </p>
          ) : (
            <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="mm-annual">연 멤버</Label>
                <Select
                  id="mm-annual"
                  value={createForm.annualMemberId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, annualMemberId: e.target.value }))}
                >
                  {annualMembers.map((am) => (
                    <option key={am.id} value={am.id}>
                      {am.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mm-year">적용 연도</Label>
                <Input
                  id="mm-year"
                  type="number"
                  value={createForm.year}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, year: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mm-month">적용 월</Label>
                <Input
                  id="mm-month"
                  type="number"
                  min={1}
                  max={12}
                  value={createForm.month}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, month: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mm-dayOfWeek">적용 요일</Label>
                <Select
                  id="mm-dayOfWeek"
                  value={createForm.dayOfWeek}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, dayOfWeek: e.target.value }))}
                >
                  {DAY_LABELS.map((label, idx) => (
                    <option key={idx} value={idx}>
                      {label}요일
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mm-memo">메모 (선택)</Label>
                <Input
                  id="mm-memo"
                  value={createForm.memo}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, memo: e.target.value }))}
                />
              </div>
              <div className="col-span-full">
                {createError && (
                  <p role="alert" aria-live="assertive" className="mb-2 text-sm text-destructive">
                    {createError}
                  </p>
                )}
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? "등록 중..." : "등록"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {year}년 {month}월 월 멤버 ({monthlyMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor="apply-dayOfWeek">요일(선택, 비우면 전체 요일)</Label>
              <Select
                id="apply-dayOfWeek"
                value={applyDayOfWeek}
                onChange={(e) => setApplyDayOfWeek(e.target.value)}
              >
                <option value="">전체 요일</option>
                {DAY_LABELS.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label}요일
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="outline" disabled={applyLoading} onClick={handleApply}>
              {applyLoading ? "실행 중..." : `${year}년 ${month}월 예약일에 일괄 자동 배정 실행`}
            </Button>
            {applyResult && (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                생성 {applyResult.createdCount}건 · 스킵 {applyResult.skippedCount}건
              </p>
            )}
            {applyError && (
              <p role="alert" aria-live="assertive" className="text-sm text-destructive">
                {applyError}
              </p>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>연 멤버</TableHead>
                <TableHead>연/월</TableHead>
                <TableHead>요일</TableHead>
                <TableHead>메모</TableHead>
                <TableHead>상태</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    해당 연/월에 등록된 월 멤버가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {monthlyMembers.map((mm) => (
                <TableRow key={mm.id}>
                  <TableCell>
                    {mm.annualMemberName}
                    {!mm.annualMemberActive && (
                      <Badge variant="secondary" className="ml-2">
                        연 멤버 비활성
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {mm.year}년 {mm.month}월
                  </TableCell>
                  <TableCell>{DAY_LABELS[mm.dayOfWeek]}요일</TableCell>
                  <TableCell>{mm.memo ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={mm.isActive ? "default" : "secondary"}>
                      {mm.isActive ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Button
                        size="sm"
                        variant={mm.isActive ? "destructive" : "secondary"}
                        disabled={rowLoadingId === mm.id}
                        onClick={() => handleToggleActive(mm)}
                      >
                        {mm.isActive ? "비활성화" : "활성화"}
                      </Button>
                      {rowError[mm.id] && (
                        <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                          {rowError[mm.id]}
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
