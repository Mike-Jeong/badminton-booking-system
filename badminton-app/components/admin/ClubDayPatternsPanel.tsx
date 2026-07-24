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

type SlotMode = "SEPARATED" | "COMBINED";

export interface ClubDayPatternRow {
  id: string;
  name: string | null;
  dayOfWeek: number;
  label: string | null;
  startTime: string;
  endTime: string;
  location: string;
  dutyPerson: string;
  totalSlots: number;
  annualSlots: number;
  casualSlots: number;
  slotMode: SlotMode;
  autoAssignMonthlyMembers: boolean;
  isActive: boolean;
}

interface PatternFormState {
  name: string;
  dayOfWeek: string;
  label: string;
  startTime: string;
  endTime: string;
  location: string;
  dutyPerson: string;
  totalSlots: string;
  annualSlots: string;
  casualSlots: string;
  slotMode: SlotMode;
  autoAssignMonthlyMembers: boolean;
  isActive: boolean;
}

const initialCreateForm: PatternFormState = {
  name: "",
  dayOfWeek: "1",
  label: "",
  startTime: "",
  endTime: "",
  location: "",
  dutyPerson: "",
  totalSlots: "",
  annualSlots: "",
  casualSlots: "",
  slotMode: "COMBINED",
  autoAssignMonthlyMembers: true,
  isActive: true,
};

function toFormState(pattern: ClubDayPatternRow): PatternFormState {
  return {
    name: pattern.name ?? "",
    dayOfWeek: String(pattern.dayOfWeek),
    label: pattern.label ?? "",
    startTime: pattern.startTime,
    endTime: pattern.endTime,
    location: pattern.location,
    dutyPerson: pattern.dutyPerson,
    totalSlots: String(pattern.totalSlots),
    annualSlots: String(pattern.annualSlots),
    casualSlots: String(pattern.casualSlots),
    slotMode: pattern.slotMode,
    autoAssignMonthlyMembers: pattern.autoAssignMonthlyMembers,
    isActive: pattern.isActive,
  };
}

function buildPayload(form: PatternFormState) {
  const isSeparated = form.slotMode === "SEPARATED";
  const annualSlots = isSeparated ? Number(form.annualSlots || 0) : 0;
  const casualSlots = isSeparated ? Number(form.casualSlots || 0) : 0;
  const totalSlots = isSeparated ? annualSlots + casualSlots : Number(form.totalSlots || 0);
  return {
    name: form.name || null,
    dayOfWeek: Number(form.dayOfWeek),
    label: form.label || null,
    startTime: form.startTime,
    endTime: form.endTime,
    location: form.location,
    dutyPerson: form.dutyPerson,
    totalSlots,
    slotMode: form.slotMode,
    annualSlots: isSeparated ? annualSlots : undefined,
    casualSlots: isSeparated ? casualSlots : undefined,
    autoAssignMonthlyMembers: form.autoAssignMonthlyMembers,
    isActive: form.isActive,
  };
}

function PatternFormFields({
  idPrefix,
  form,
  update,
}: {
  idPrefix: string;
  form: PatternFormState;
  update: <K extends keyof PatternFormState>(key: K, value: PatternFormState[K]) => void;
}) {
  const isSeparated = form.slotMode === "SEPARATED";
  const computedTotalSlots = Number(form.annualSlots || 0) + Number(form.casualSlots || 0);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>패턴 이름 (선택)</Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="예: 월요일 A체육관 저녁"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-dayOfWeek`}>요일</Label>
        <Select
          id={`${idPrefix}-dayOfWeek`}
          value={form.dayOfWeek}
          onChange={(e) => update("dayOfWeek", e.target.value)}
        >
          {DAY_LABELS.map((label, idx) => (
            <option key={idx} value={idx}>
              {label}요일
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-label`}>세션 라벨 (선택)</Label>
        <Input
          id={`${idPrefix}-label`}
          placeholder="예: 오전, 오후, 1부"
          value={form.label}
          onChange={(e) => update("label", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-startTime`}>시작 시간</Label>
        <Input
          id={`${idPrefix}-startTime`}
          type="time"
          value={form.startTime}
          onChange={(e) => update("startTime", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-endTime`}>종료 시간</Label>
        <Input
          id={`${idPrefix}-endTime`}
          type="time"
          value={form.endTime}
          onChange={(e) => update("endTime", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-location`}>장소</Label>
        <Input
          id={`${idPrefix}-location`}
          value={form.location}
          onChange={(e) => update("location", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-dutyPerson`}>듀티 담당자</Label>
        <Input
          id={`${idPrefix}-dutyPerson`}
          value={form.dutyPerson}
          onChange={(e) => update("dutyPerson", e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-slotMode`}>슬롯 정책</Label>
        <Select
          id={`${idPrefix}-slotMode`}
          value={form.slotMode}
          onChange={(e) => update("slotMode", e.target.value as SlotMode)}
        >
          <option value="COMBINED">통합 슬롯 (COMBINED)</option>
          <option value="SEPARATED">분리 슬롯 (SEPARATED)</option>
        </Select>
      </div>

      {isSeparated ? (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-annualSlots`}>연 멤버 슬롯 수</Label>
            <Input
              id={`${idPrefix}-annualSlots`}
              type="number"
              min={0}
              value={form.annualSlots}
              onChange={(e) => update("annualSlots", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-casualSlots`}>캐주얼 슬롯 수</Label>
            <Input
              id={`${idPrefix}-casualSlots`}
              type="number"
              min={0}
              value={form.casualSlots}
              onChange={(e) => update("casualSlots", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-totalSlots`}>전체 슬롯 수</Label>
            <Input id={`${idPrefix}-totalSlots`} type="number" value={computedTotalSlots} disabled readOnly />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-totalSlots`}>전체 슬롯 수</Label>
          <Input
            id={`${idPrefix}-totalSlots`}
            type="number"
            min={0}
            value={form.totalSlots}
            onChange={(e) => update("totalSlots", e.target.value)}
            required
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          id={`${idPrefix}-autoAssign`}
          type="checkbox"
          checked={form.autoAssignMonthlyMembers}
          onChange={(e) => update("autoAssignMonthlyMembers", e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor={`${idPrefix}-autoAssign`}>이 패턴에서 생성되는 모든 회차에 월 멤버 자동 배정</Label>
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`${idPrefix}-isActive`}
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => update("isActive", e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor={`${idPrefix}-isActive`}>활성(크론 생성 대상)</Label>
      </div>
    </>
  );
}

export function ClubDayPatternsPanel({ patterns }: { patterns: ClubDayPatternRow[] }) {
  const router = useRouter();

  const [createForm, setCreateForm] = useState<PatternFormState>(initialCreateForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  function updateCreate<K extends keyof PatternFormState>(key: K, value: PatternFormState[K]) {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/club-day-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(createForm)),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json?.error?.message ?? "등록에 실패했습니다.");
        return;
      }
      setCreateForm(initialCreateForm);
      router.refresh();
    } catch {
      setCreateError("네트워크 오류가 발생했습니다.");
    } finally {
      setCreateLoading(false);
    }
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PatternFormState>(initialCreateForm);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  function startEdit(pattern: ClubDayPatternRow) {
    setEditingId(pattern.id);
    setEditForm(toFormState(pattern));
    setRowError((prev) => ({ ...prev, [pattern.id]: "" }));
  }

  function updateEdit<K extends keyof PatternFormState>(key: K, value: PatternFormState[K]) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleEditSave(id: string) {
    setRowLoadingId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/club-day-patterns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(editForm)),
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

  async function handleToggleActive(pattern: ClubDayPatternRow) {
    setRowLoadingId(pattern.id);
    setRowError((prev) => ({ ...prev, [pattern.id]: "" }));
    try {
      const res = await fetch(`/api/admin/club-day-patterns/${pattern.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !pattern.isActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [pattern.id]: json?.error?.message ?? "처리에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [pattern.id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleDelete(pattern: ClubDayPatternRow) {
    if (
      !window.confirm(
        `${pattern.name ?? DAY_LABELS[pattern.dayOfWeek] + "요일 패턴"}을(를) 삭제하시겠습니까?\n목록에서 완전히 사라지며 되돌릴 수 없습니다. (과거 생성된 클럽데이 자체는 영향을 받지 않습니다.)`
      )
    ) {
      return;
    }
    setRowLoadingId(pattern.id);
    setRowError((prev) => ({ ...prev, [pattern.id]: "" }));
    try {
      const res = await fetch(`/api/admin/club-day-patterns/${pattern.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [pattern.id]: json?.error?.message ?? "삭제에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [pattern.id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>클럽데이 패턴 등록</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PatternFormFields idPrefix="create" form={createForm} update={updateCreate} />

            {createError && (
              <p role="alert" aria-live="assertive" className="col-span-full text-sm text-destructive">
                {createError}
              </p>
            )}

            <div className="col-span-full">
              <Button type="submit" disabled={createLoading}>
                {createLoading ? "등록 중..." : "패턴 등록"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>클럽데이 패턴 목록 ({patterns.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>요일</TableHead>
                <TableHead>시간</TableHead>
                <TableHead>장소</TableHead>
                <TableHead>듀티</TableHead>
                <TableHead>슬롯</TableHead>
                <TableHead>월멤버 자동배정</TableHead>
                <TableHead>상태</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patterns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    등록된 클럽데이 패턴이 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {patterns.map((pattern) =>
                editingId === pattern.id ? (
                  <TableRow key={pattern.id}>
                    <TableCell colSpan={9}>
                      <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
                        <PatternFormFields idPrefix={`edit-${pattern.id}`} form={editForm} update={updateEdit} />
                        <div className="col-span-full flex flex-col items-start gap-2">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={rowLoadingId === pattern.id}
                              onClick={() => handleEditSave(pattern.id)}
                            >
                              저장
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                              취소
                            </Button>
                          </div>
                          {rowError[pattern.id] && (
                            <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                              {rowError[pattern.id]}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={pattern.id}>
                    <TableCell>{pattern.name ?? "-"}</TableCell>
                    <TableCell>{DAY_LABELS[pattern.dayOfWeek]}요일</TableCell>
                    <TableCell>
                      {pattern.startTime} ~ {pattern.endTime}
                    </TableCell>
                    <TableCell>{pattern.location}</TableCell>
                    <TableCell>{pattern.dutyPerson}</TableCell>
                    <TableCell>
                      {pattern.slotMode === "SEPARATED"
                        ? `연 ${pattern.annualSlots} + 캐 ${pattern.casualSlots} = ${pattern.totalSlots}`
                        : `${pattern.totalSlots}`}
                    </TableCell>
                    <TableCell>{pattern.autoAssignMonthlyMembers ? "예" : "아니오"}</TableCell>
                    <TableCell>
                      <Badge variant={pattern.isActive ? "default" : "secondary"}>
                        {pattern.isActive ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(pattern)}>
                            수정
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowLoadingId === pattern.id}
                            onClick={() => handleToggleActive(pattern)}
                          >
                            {pattern.isActive ? "비활성화" : "활성화"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={rowLoadingId === pattern.id}
                            onClick={() => handleDelete(pattern)}
                          >
                            삭제
                          </Button>
                        </div>
                        {rowError[pattern.id] && (
                          <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                            {rowError[pattern.id]}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
