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
  annualMemberPhone: string;
  annualMemberActive: boolean;
  year: number;
  month: number;
  dayOfWeek: number;
  isActive: boolean;
  memo: string | null;
}

/**
 * 같은 연 멤버가 여러 요일에 등록되어 있으면 목록에서 이름/전화번호가 요일 수만큼
 * 반복 표시되던 문제(관리자 피드백)를 해결하기 위해 연 멤버 단위로 행을 묶는다.
 * 서버가 이미 dayOfWeek asc로 정렬해 반환하므로, 그룹 내부 순서는 그대로 요일 오름차순이 유지된다.
 */
function groupByAnnualMember(rows: MonthlyMemberRow[]): MonthlyMemberRow[][] {
  const order: string[] = [];
  const groups = new Map<string, MonthlyMemberRow[]>();
  for (const row of rows) {
    if (!groups.has(row.annualMemberId)) {
      groups.set(row.annualMemberId, []);
      order.push(row.annualMemberId);
    }
    groups.get(row.annualMemberId)!.push(row);
  }
  return order.map((id) => groups.get(id)!);
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
  const [createAssignmentResult, setCreateAssignmentResult] = useState<{
    createdCount: number;
    skippedCount: number;
  } | null>(null);

  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ year: "", month: "", dayOfWeek: "", memo: "" });

  const [dayOfWeekFilter, setDayOfWeekFilter] = useState<string>("");
  const filteredMembers =
    dayOfWeekFilter === "" ? monthlyMembers : monthlyMembers.filter((mm) => mm.dayOfWeek === Number(dayOfWeekFilter));

  function handleFilterSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(`/admin/monthly-members?year=${filterYear}&month=${filterMonth}`);
  }

  async function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setCreateAssignmentResult(null);

    // 등록한 연/월/요일과 일치하는 예약일이 이미 만들어져 있을 수 있다. 무조건 소급 배정하면
    // 같은 요일에 세션이 여러 개 있을 때 중복 배정될 수 있어 관리자 확인을 거친다(decisions.md D-22).
    const applyToExistingBookingDays = window.confirm(
      "이 연/월/요일과 일치하는, 이미 생성되어 있는 예약일에도 자동으로 추가하시겠습니까?\n(같은 요일에 세션이 여러 개 있다면 '취소'를 눌러 건너뛸 수 있습니다.)"
    );

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
          applyToExistingBookingDays,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json?.error?.message ?? "등록에 실패했습니다.");
        return;
      }
      if (json.data?.existingBookingDayAssignment) {
        setCreateAssignmentResult(json.data.existingBookingDayAssignment);
      }
      setCreateForm((prev) => ({ ...prev, memo: "" }));
      router.refresh();
    } catch {
      setCreateError("네트워크 오류가 발생했습니다.");
    } finally {
      setCreateLoading(false);
    }
  }

  function startEdit(member: MonthlyMemberRow) {
    setEditingId(member.id);
    setEditForm({
      year: String(member.year),
      month: String(member.month),
      dayOfWeek: String(member.dayOfWeek),
      memo: member.memo ?? "",
    });
    setRowError((prev) => ({ ...prev, [member.id]: "" }));
  }

  async function handleEditSave(id: string) {
    setRowLoadingId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/monthly-members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: Number(editForm.year),
          month: Number(editForm.month),
          dayOfWeek: Number(editForm.dayOfWeek),
          memo: editForm.memo || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: json?.error?.message ?? "수정에 실패했습니다." }));
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
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
                {createAssignmentResult && (
                  <p aria-live="polite" className="mb-2 text-sm text-muted-foreground">
                    기존 예약일 자동 배정: 생성 {createAssignmentResult.createdCount}건 · 스킵{" "}
                    {createAssignmentResult.skippedCount}건
                  </p>
                )}
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
            {year}년 {month}월 월 멤버 ({filteredMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor="dayOfWeek-filter">요일(선택, 비우면 전체 요일)</Label>
              <Select
                id="dayOfWeek-filter"
                value={dayOfWeekFilter}
                onChange={(e) => setDayOfWeekFilter(e.target.value)}
              >
                <option value="">전체 요일</option>
                {DAY_LABELS.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label}요일
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>연 멤버</TableHead>
                <TableHead>전화번호</TableHead>
                <TableHead>연/월</TableHead>
                <TableHead>요일</TableHead>
                <TableHead>메모</TableHead>
                <TableHead>상태</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    {monthlyMembers.length === 0
                      ? "해당 연/월에 등록된 월 멤버가 없습니다."
                      : "해당 요일에 등록된 월 멤버가 없습니다."}
                  </TableCell>
                </TableRow>
              )}
              {groupByAnnualMember(filteredMembers).map((group, groupIdx) =>
                group.map((mm, rowIdx) => (
                  <TableRow key={mm.id} className={groupIdx > 0 && rowIdx === 0 ? "border-t-2" : undefined}>
                    {rowIdx === 0 && (
                      <>
                        <TableCell rowSpan={group.length} className="align-top">
                          {mm.annualMemberName}
                          {!mm.annualMemberActive && (
                            <Badge variant="secondary" className="ml-2">
                              연 멤버 비활성
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell rowSpan={group.length} className="align-top">
                          {mm.annualMemberPhone}
                        </TableCell>
                      </>
                    )}
                    {editingId === mm.id ? (
                      <>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              className="w-20"
                              value={editForm.year}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, year: e.target.value }))}
                            />
                            <Input
                              type="number"
                              min={1}
                              max={12}
                              className="w-16"
                              value={editForm.month}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, month: e.target.value }))}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={editForm.dayOfWeek}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, dayOfWeek: e.target.value }))}
                          >
                            {DAY_LABELS.map((label, idx) => (
                              <option key={idx} value={idx}>
                                {label}요일
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editForm.memo}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, memo: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={mm.isActive ? "default" : "secondary"}>
                            {mm.isActive ? "활성" : "비활성"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={rowLoadingId === mm.id}
                                onClick={() => handleEditSave(mm.id)}
                              >
                                저장
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                취소
                              </Button>
                            </div>
                            {rowError[mm.id] && (
                              <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                                {rowError[mm.id]}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
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
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => startEdit(mm)}>
                                수정
                              </Button>
                              <Button
                                size="sm"
                                variant={mm.isActive ? "destructive" : "secondary"}
                                disabled={rowLoadingId === mm.id}
                                onClick={() => handleToggleActive(mm)}
                              >
                                {mm.isActive ? "비활성화" : "활성화"}
                              </Button>
                            </div>
                            {rowError[mm.id] && (
                              <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                                {rowError[mm.id]}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
